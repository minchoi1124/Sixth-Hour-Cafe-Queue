import { FieldValue } from "firebase/firestore";

export type MenuItem = {
  id: string; // Firestore document ID
  name: string;
  inStock: boolean;
  category: string;
  order: number;
};

export type OrderItem = {
    id: string;
    name: string;
    oatMilk: boolean;
}

export type Order = {
  id: string; // Firestore document ID
  customerName: string;
  items: OrderItem[];
  createdAt: string; // ISO string for client
  status: 'pending' | 'completed';
};

export type NewOrder = {
  customerName: string;
  items: OrderItem[];
}

export type FirestoreOrder = Omit<Order, 'id' | 'createdAt'> & {
  createdAt: FieldValue;
};

export type Category = {
    id: string;
    name: string;
}
