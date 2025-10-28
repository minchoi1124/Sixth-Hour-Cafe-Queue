'use server';
import {
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
} from 'firebase/firestore';
import { initializeServerApp } from '@/firebase/server-app';
import type { Order, MenuItem, NewOrder, Category } from './definitions';

// This is a server-side only file.

const MENU_COLLECTION = 'drinks';
const ORDERS_COLLECTION = 'orders';
const CATEGORIES_COLLECTION = 'categories';

const getDb = async () => {
    const { firestore } = await initializeServerApp();
    return firestore;
}

export const getCategories = async (): Promise<Category[]> => {
    const firestore = await getDb();
    const snapshot = await getDocs(query(collection(firestore, CATEGORIES_COLLECTION), orderBy('name')));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
};

export const addCategory = async (name: string): Promise<void> => {
    const firestore = await getDb();
    await addDoc(collection(firestore, CATEGORIES_COLLECTION), { name });
};

export const updateCategory = async (id: string, name: string): Promise<void> => {
    const firestore = await getDb();
    const docRef = doc(firestore, CATEGORIES_COLLECTION, id);
    await updateDoc(docRef, { name });
};

export const deleteCategory = async (id: string): Promise<void> => {
    // Note: This doesn't handle migrating drinks in the deleted category.
    // For this app's purpose, we'll allow drinks to have stale categories.
    const firestore = await getDb();
    const docRef = doc(firestore, CATEGORIES_COLLECTION, id);
    await deleteDoc(docRef);
};


export const getMenu = async (): Promise<MenuItem[]> => {
  const firestore = await getDb();
  const menuSnapshot = await getDocs(collection(firestore, MENU_COLLECTION));
  const menu: MenuItem[] = [];
  menuSnapshot.forEach((doc) => {
    menu.push({ id: doc.id, ...doc.data() } as MenuItem);
  });
  return menu;
};

export const updateMenu = async (updatedMenu: MenuItem[]): Promise<void> => {
  const firestore = await getDb();
  const batch = writeBatch(firestore);
  updatedMenu.forEach((item) => {
    const { id, ...data } = item;
    const docRef = doc(firestore, MENU_COLLECTION, id);
    batch.set(docRef, data, { merge: true });
  });
  await batch.commit();
};

export const addMenuItem = async (name: string, category: string): Promise<MenuItem> => {
  const firestore = await getDb();
  const newItem = {
    name,
    category,
    inStock: true,
  };
  const docRef = await addDoc(collection(firestore, MENU_COLLECTION), newItem);
  return { ...newItem, id: docRef.id };
};

export const getOrders = async (): Promise<Order[]> => {
  const firestore = await getDb();
  const q = query(
    collection(firestore, ORDERS_COLLECTION),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc')
  );
  const ordersSnapshot = await getDocs(q);
  const orders: Order[] = [];
  ordersSnapshot.forEach((doc) => {
    const data = doc.data();
    orders.push({ 
      id: doc.id,
      ...data,
      // Convert Firestore Timestamp to ISO string for client-side compatibility
      createdAt: data.createdAt.toDate().toISOString(),
    } as Order);
  });
  return orders;
};

export const addOrder = async (order: NewOrder): Promise<void> => {
  const firestore = await getDb();
  await addDoc(collection(firestore, ORDERS_COLLECTION), {
    ...order,
    createdAt: serverTimestamp(),
    status: 'pending',
  });
};

export const completeOrder = async (orderId: string): Promise<void> => {
  const firestore = await getDb();
  const docRef = doc(firestore, ORDERS_COLLECTION, orderId);
  // Instead of changing status, we just delete it for simplicity
  await deleteDoc(docRef);
};