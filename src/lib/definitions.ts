import { FieldValue } from "firebase/firestore";

export type Modification = {
  id: string;
  name: string;
  default: boolean;
};

export type MenuItem = {
  id: string; // Firestore document ID
  name: string;
  description: string;
  inStock: boolean;
  category: string;
  order: number;
  modifications: Modification[];
};

export type OrderItem = {
    id: string; // ID of the base menu item
    name: string;
    modifications: string[]; // Names of selected modifications
}

export type Order = {
  id: string; // Firestore document ID
  customerName: string;
  items: OrderItem[];
  createdAt: string; // ISO string for client
  status: 'pending' | 'completed' | 'archived';
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

export type Cafe = {
  id: string; // == owner uid == cafeId
  name: string;
  slug: string;
  createdAt?: string;
};
