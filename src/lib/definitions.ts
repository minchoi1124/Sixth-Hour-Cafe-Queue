import { FieldValue } from "firebase/firestore";

export type MenuItem = {
  id: string; // Firestore document ID
  name: string;
  inStock: boolean;
  category: string;
};

export type Order = {
  id: string; // Firestore document ID
  customerName: string;
  items: Pick<MenuItem, 'id' | 'name'>[];
  createdAt: string; // ISO string for client
  status: 'pending' | 'completed';
};

export type NewOrder = {
  customerName: string;
  items: Pick<MenuItem, 'id' | 'name'>[];
}

export type FirestoreOrder = Omit<Order, 'id' | 'createdAt'> & {
  createdAt: FieldValue;
};
