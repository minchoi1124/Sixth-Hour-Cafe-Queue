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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// --- Firebase Server SDK Initialization (Singleton Pattern) ---
// This ensures we only initialize the app once on the server.
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

export const getCategories = async (): Promise<Category[]> => {
    const firestore = getDb();
    const snapshot = await getDocs(query(collection(firestore, CATEGORIES_COLLECTION), orderBy('name')));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
};

export const addCategory = async (name: string): Promise<void> => {
    const firestore = getDb();
    const colRef = collection(firestore, CATEGORIES_COLLECTION);
    const data = { name };
    await addDoc(colRef, data).catch(error => {
      throw new FirestorePermissionError({
        path: colRef.path,
        operation: 'create',
        requestResourceData: data
      })
    });
};

export const updateCategory = async (id: string, name: string): Promise<void> => {
    const firestore = getDb();
    const docRef = doc(firestore, CATEGORIES_COLLECTION, id);
    const data = { name };
    await updateDoc(docRef, data).catch(error => {
      throw new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: data
      })
    });
};

export const deleteCategory = async (id: string): Promise<void> => {
    const firestore = getDb();
    const docRef = doc(firestore, CATEGORIES_COLLECTION, id);
    await deleteDoc(docRef).catch(error => {
      throw new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete'
      })
    });
};


export const getMenu = async (): Promise<MenuItem[]> => {
  const firestore = getDb();
  const menuSnapshot = await getDocs(collection(firestore, MENU_COLLECTION));
  const menu: MenuItem[] = [];
  menuSnapshot.forEach((doc) => {
    menu.push({ id: doc.id, ...doc.data() } as MenuItem);
  });
  return menu;
};

export const updateMenu = async (updatedMenu: MenuItem[]): Promise<void> => {
    const firestore = getDb();
    const batch = writeBatch(firestore);
    updatedMenu.forEach((item) => {
        const { id, ...data } = item;
        const docRef = doc(firestore, MENU_COLLECTION, id);
        batch.set(docRef, data, { merge: true });
    });
    
    await batch.commit().catch(error => {
        // Note: Batch writes don't give specific document errors in the catch block.
        // The error will be generic. For more detailed errors, individual writes are needed.
        // For this app, we'll throw a generic path error for the collection.
        throw new FirestorePermissionError({
            path: MENU_COLLECTION,
            operation: 'write', // Represents a batch write
            requestResourceData: {info: "Batch update for multiple menu items."}
        });
    });
};

export const addMenuItem = async (name: string, category: string): Promise<MenuItem> => {
  const firestore = getDb();
  const colRef = collection(firestore, MENU_COLLECTION);
  const newItem = {
    name,
    category,
    inStock: true,
  };
  const docRef = await addDoc(colRef, newItem).catch(error => {
    throw new FirestorePermissionError({
        path: colRef.path,
        operation: 'create',
        requestResourceData: newItem
    });
  });
  return { ...newItem, id: docRef.id };
};

export const getOrders = async (): Promise<Order[]> => {
  const firestore = getDb();
  const q = query(
    collection(firestore, ORDERS_COLLECTION),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc')
  );
  const ordersSnapshot = await getDocs(q);
  const orders: Order[] = [];
  ordersSnapshot.forEach((doc) => {
    const data = doc.data();
    // The data from firestore is a Timestamp, but the Order type expects a string
    // This was causing an issue on the client so we need to convert it here.
    const createdAt = (data.createdAt as Timestamp)?.toDate().toISOString();
    orders.push({ 
      id: doc.id,
      ...data,
      createdAt: createdAt,
    } as Order);
  });
  return orders;
};

export const addOrder = async (order: NewOrder): Promise<void> => {
  const firestore = getDb();
  const colRef = collection(firestore, ORDERS_COLLECTION);
  const data = {
    ...order,
    createdAt: serverTimestamp(),
    status: 'pending',
  };
  await addDoc(colRef, data).catch(error => {
    throw new FirestorePermissionError({
        path: colRef.path,
        operation: 'create',
        requestResourceData: data
    });
  });
};

export const completeOrder = async (orderId: string): Promise<void> => {
  const firestore = getDb();
  const docRef = doc(firestore, ORDERS_COLLECTION, orderId);
  // Using update instead of delete to trigger a 'write' for rules, which is more common
  // than allowing direct deletes.
  const data = { status: 'completed' };
  await updateDoc(docRef, data).catch(error => {
    throw new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: data
    });
  });
};