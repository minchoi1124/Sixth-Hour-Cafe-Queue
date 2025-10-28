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
import { FirestorePermissionError } from '@/firebase/errors';

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

export const getCategories = async (): Promise<Category[]> => {
    const firestore = getDb();
    const snapshot = await getDocs(query(collection(firestore, CATEGORIES_COLLECTION), orderBy('name')));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
};

export const getMenu = async (): Promise<MenuItem[]> => {
  const firestore = getDb();
  const q = query(collection(firestore, MENU_COLLECTION), orderBy('order', 'asc'));
  const menuSnapshot = await getDocs(q);
  const menu: MenuItem[] = [];
  menuSnapshot.forEach((doc) => {
    menu.push({ id: doc.id, ...doc.data() } as MenuItem);
  });
  return menu;
};

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
