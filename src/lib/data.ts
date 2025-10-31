
'use server';

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { Order, MenuItem, NewOrder, Category } from './definitions';
import { FirestorePermissionError, FirestoreRateLimitError, isRateLimitError, isPermissionError } from '@/firebase/errors';

// --- Firebase Server SDK Initialization (Singleton Pattern) ---
const getDb = () => {
    if (!getApps().length) {
        initializeApp(firebaseConfig);
    }
    return getFirestore();
};
// --- End of Initialization ---

const MENU_COLLECTION = 'drinks';
const ORDERS_COLLECTION = 'orders';
const CATEGORIES_COLLECTION = 'categories';

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

export const getCategories = async (): Promise<Category[]> => {
  const firestore = getDb();
  const q = query(collection(firestore, CATEGORIES_COLLECTION), orderBy('name'));

  try {
    return await retryWithBackoff(async () => {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
    });
  } catch (error) {
    // Handle rate limit errors specifically
    if (isRateLimitError(error)) {
      throw new FirestoreRateLimitError(CATEGORIES_COLLECTION, 'list');
    }

    // Handle permission errors
    if (isPermissionError(error)) {
      throw new FirestorePermissionError({
        path: CATEGORIES_COLLECTION,
        operation: 'list',
      });
    }

    // Re-throw other errors as-is
    throw error;
  }
};

export const getMenu = async (): Promise<MenuItem[]> => {
  const firestore = getDb();
  const q = query(collection(firestore, MENU_COLLECTION), orderBy('order', 'asc'));

  try {
    return await retryWithBackoff(async () => {
      const menuSnapshot = await getDocs(q);
      const menu: MenuItem[] = [];
      menuSnapshot.forEach((doc) => {
        menu.push({ id: doc.id, ...doc.data() } as MenuItem);
      });
      return menu;
    });
  } catch (error) {
    // Handle rate limit errors specifically
    if (isRateLimitError(error)) {
      throw new FirestoreRateLimitError(MENU_COLLECTION, 'list');
    }

    // Handle permission errors
    if (isPermissionError(error)) {
      throw new FirestorePermissionError({
        path: MENU_COLLECTION,
        operation: 'list',
      });
    }

    // Re-throw other errors as-is
    throw error;
  }
};

export const getOrders = async (): Promise<Order[]> => {
  const firestore = getDb();
  const q = query(
    collection(firestore, ORDERS_COLLECTION),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc')
  );
  try {
    const orderSnapshot = await getDocs(q);
    const orders: Order[] = [];
    orderSnapshot.forEach((doc) => {
      const data = doc.data();
      // Convert Firestore Timestamp to ISO string for client-side compatibility
      const createdAt = (data.createdAt as Timestamp)?.toDate().toISOString() ?? new Date().toISOString();
      orders.push({ id: doc.id, ...data, createdAt } as Order);
    });
    return orders;
  } catch (e) {
    console.warn("Server-side getOrders failed, likely due to permissions. The client-side real-time listener will take over.");
    // Return an empty array to allow the page to render.
    // The client-side useCollection hook will then fetch the data in real-time.
    return [];
  }
};

export const getCompletedOrders = async (): Promise<Order[]> => {
  const firestore = getDb();
  const q = query(
    collection(firestore, ORDERS_COLLECTION),
    where('status', '==', 'completed'),
    orderBy('createdAt', 'desc')
  );
  try {
    const orderSnapshot = await getDocs(q);
    const orders: Order[] = [];
    orderSnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = (data.createdAt as Timestamp)?.toDate().toISOString() ?? new Date().toISOString();
      orders.push({ id: doc.id, ...data, createdAt } as Order);
    });
    return orders;
  } catch (error) {
    console.error("Failed to fetch completed orders:", error);
    // On error, return an empty array to prevent the page from crashing.
    return [];
  }
}


export const addOrder = async (order: NewOrder): Promise<void> => {
  const firestore = getDb();
  const colRef = collection(firestore, ORDERS_COLLECTION);
  const data = {
    ...order,
    createdAt: serverTimestamp(),
    status: 'pending',
  };
  try {
    await addDoc(colRef, data);
  } catch (error) {
    throw new FirestorePermissionError({
        path: colRef.path,
        operation: 'create',
        requestResourceData: data
    });
  }
};

export const completeOrder = async (orderId: string): Promise<void> => {
  const firestore = getDb();
  const docRef = doc(firestore, ORDERS_COLLECTION, orderId);
  const data = { status: 'completed' };
  try {
    await updateDoc(docRef, data);
  } catch (error) {
    throw new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: data
    });
  }
};

export const archiveSingleOrder = async (orderId: string): Promise<void> => {
  const firestore = getDb();
  const docRef = doc(firestore, ORDERS_COLLECTION, orderId);
  const data = { status: 'archived' };
  try {
    await updateDoc(docRef, data);
  } catch (error) {
    throw new FirestorePermissionError({
      path: docRef.path,
      operation: 'update',
      requestResourceData: data
    });
  }
};

export const clearCompletedOrders = async (): Promise<void> => {
  const firestore = getDb();
  const ordersRef = collection(firestore, ORDERS_COLLECTION);
  const q = query(ordersRef, where('status', '==', 'completed'));
  
  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return; // Nothing to archive
    }

    const batch = writeBatch(firestore);
    querySnapshot.forEach(doc => {
      batch.update(doc.ref, { status: 'archived' });
    });

    await batch.commit();
  } catch (error) {
    throw new FirestorePermissionError({
        path: ordersRef.path,
        operation: 'update' 
    });
  }
};

export const deleteOrder = async (orderId: string): Promise<void> => {
  const firestore = getDb();
  const docRef = doc(firestore, ORDERS_COLLECTION, orderId);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    throw new FirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    });
  }
};
