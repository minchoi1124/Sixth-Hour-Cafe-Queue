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
} from 'firebase/firestore';
import { getSdks } from '@/firebase';
import type { Order, MenuItem, NewOrder } from './definitions';

// This is a server-side only file.
// We use getSdks to get the admin-like firestore instance.
const { firestore } = getSdks();

const MENU_COLLECTION = 'drinks';
const ORDERS_COLLECTION = 'orders';

export const getMenu = async (): Promise<MenuItem[]> => {
  const menuSnapshot = await getDocs(collection(firestore, MENU_COLLECTION));
  const menu: MenuItem[] = [];
  menuSnapshot.forEach((doc) => {
    menu.push({ id: doc.id, ...doc.data() } as MenuItem);
  });
  return menu;
};

export const updateMenu = async (updatedMenu: MenuItem[]): Promise<void> => {
  const batch = writeBatch(firestore);
  updatedMenu.forEach((item) => {
    const { id, ...data } = item;
    const docRef = doc(firestore, MENU_COLLECTION, id);
    batch.set(docRef, data, { merge: true });
  });
  await batch.commit();
};

export const addMenuItem = async (name: string, category: string): Promise<MenuItem> => {
  const newItem = {
    name,
    category,
    inStock: true,
  };
  const docRef = await addDoc(collection(firestore, MENU_COLLECTION), newItem);
  return { ...newItem, id: docRef.id };
};

export const getOrders = async (): Promise<Order[]> => {
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
  await addDoc(collection(firestore, ORDERS_COLLECTION), {
    ...order,
    createdAt: serverTimestamp(),
    status: 'pending',
  });
};

export const completeOrder = async (orderId: string): Promise<void> => {
  const docRef = doc(firestore, ORDERS_COLLECTION, orderId);
  // Instead of changing status, we just delete it for simplicity
  await deleteDoc(docRef);
};
