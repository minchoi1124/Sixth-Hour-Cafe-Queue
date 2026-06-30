
'use server';

import {
  getFirestore,
  collection,
  getDoc,
  getDocs,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { MenuItem, Cafe } from './definitions';
import { FirestoreRateLimitError, isRateLimitError } from '@/firebase/errors';

// --- Firebase Server SDK Initialization (Singleton Pattern) ---
// These server-side reads use the client SDK with no auth context, so they can
// only ever read data that the Firestore rules expose publicly: the slug -> cafe
// lookup and a cafe's menu/categories. All owner and order data is read on the
// client by the authenticated owner via real-time listeners.
const getDb = () => {
    if (!getApps().length) {
        initializeApp(firebaseConfig);
    }
    return getFirestore();
};
// --- End of Initialization ---

// --- Retry Utility with Exponential Backoff ---
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Only retry on rate limit errors
      if (!isRateLimitError(error)) {
        throw error;
      }

      // Don't wait after the last attempt
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
// --- End of Retry Utility ---

/** Resolve a public cafe slug to its cafe record, or null if it doesn't exist. */
export const getCafeBySlug = async (slug: string): Promise<Cafe | null> => {
  const firestore = getDb();
  try {
    const slugSnap = await getDoc(doc(firestore, 'slugs', slug));
    if (!slugSnap.exists()) return null;
    const cafeId = slugSnap.data().cafeId as string;

    const cafeSnap = await getDoc(doc(firestore, 'cafes', cafeId));
    if (!cafeSnap.exists()) return null;

    return { id: cafeSnap.id, ...(cafeSnap.data() as Omit<Cafe, 'id'>) };
  } catch (error) {
    console.error(`Failed to resolve cafe for slug "${slug}":`, error);
    return null;
  }
};

export const getMenuForCafe = async (cafeId: string): Promise<MenuItem[]> => {
  const firestore = getDb();
  const q = query(collection(firestore, 'cafes', cafeId, 'drinks'), orderBy('order', 'asc'));

  try {
    return await retryWithBackoff(async () => {
      const menuSnapshot = await getDocs(q);
      const menu: MenuItem[] = [];
      menuSnapshot.forEach((d) => {
        menu.push({ id: d.id, ...d.data() } as MenuItem);
      });
      return menu;
    });
  } catch (error) {
    if (isRateLimitError(error)) {
      throw new FirestoreRateLimitError(`cafes/${cafeId}/drinks`, 'list');
    }
    console.error('Failed to fetch menu:', error);
    return [];
  }
};
