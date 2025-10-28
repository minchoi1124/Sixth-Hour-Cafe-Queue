import type { Order, MenuItem } from './definitions';

// In-memory store
let orders: Order[] = [];
const menu: MenuItem[] = [
  { id: 1, name: 'Maple Matcha Latte', inStock: true },
  { id: 2, name: 'Dalgona Whipped Coffee', inStock: true },
  { id: 3, name: 'London Fog', inStock: true },
  { id: 4, name: 'Apple Cider Chai', inStock: false },
];

export const getMenu = async (): Promise<MenuItem[]> => {
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 100));
  return Promise.resolve(menu);
};

export const updateMenu = async (updatedMenu: MenuItem[]): Promise<MenuItem[]> => {
  await new Promise(resolve => setTimeout(resolve, 100));
  // This is a simple example. In a real app, you'd update a database.
  updatedMenu.forEach(updatedItem => {
    const itemIndex = menu.findIndex(i => i.id === updatedItem.id);
    if (itemIndex !== -1) {
      menu[itemIndex] = updatedItem;
    }
  });
  return Promise.resolve(menu);
};

export const getOrders = async (): Promise<Order[]> => {
  await new Promise(resolve => setTimeout(resolve, 100));
  return Promise.resolve(
    orders
      .filter(o => o.status === 'pending')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  );
};

export const addOrder = async (order: Omit<Order, 'id' | 'createdAt' | 'status'>): Promise<Order> => {
  await new Promise(resolve => setTimeout(resolve, 100));
  const newOrder: Order = {
    ...order,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  orders.push(newOrder);
  return Promise.resolve(newOrder);
};

export const completeOrder = async (orderId: string): Promise<Order | undefined> => {
  await new Promise(resolve => setTimeout(resolve, 100));
  const orderIndex = orders.findIndex(o => o.id === orderId);
  if (orderIndex > -1) {
    orders[orderIndex].status = 'completed';
    // For this simulation, we'll just mark as completed. A real app might move it to a different collection or filter it out.
    return Promise.resolve(orders[orderIndex]);
  }
  return Promise.resolve(undefined);
};
