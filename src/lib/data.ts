'use server';

import { adminDb } from './firebase-admin';
import type { MenuItem, Cafe } from './definitions';

/** Resolve a public cafe slug to its cafe record, or null if it doesn't exist. */
export const getCafeBySlug = async (slug: string): Promise<Cafe | null> => {
  try {
    const slugSnap = await adminDb.doc(`slugs/${slug}`).get();
    if (!slugSnap.exists) return null;
    const cafeId = slugSnap.data()!.cafeId as string;

    const cafeSnap = await adminDb.doc(`cafes/${cafeId}`).get();
    if (!cafeSnap.exists) return null;

    return { id: cafeSnap.id, ...(cafeSnap.data() as Omit<Cafe, 'id'>) };
  } catch (error) {
    console.error(`Failed to resolve cafe for slug "${slug}":`, error);
    return null;
  }
};

export const getMenuForCafe = async (cafeId: string): Promise<MenuItem[]> => {
  try {
    const snapshot = await adminDb
      .collection(`cafes/${cafeId}/drinks`)
      .orderBy('order', 'asc')
      .get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as MenuItem);
  } catch (error) {
    console.error('Failed to fetch menu:', error);
    return [];
  }
};
