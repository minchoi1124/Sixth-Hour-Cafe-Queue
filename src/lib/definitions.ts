export type MenuItem = {
  id: number;
  name: string;
  inStock: boolean;
};

export type Order = {
  id: string; // uuid
  customerName: string;
  items: Pick<MenuItem, 'id' | 'name'>[];
  createdAt: string; // ISO string
  status: 'pending' | 'completed';
};
