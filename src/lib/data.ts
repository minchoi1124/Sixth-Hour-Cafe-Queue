import type { Order, MenuItem } from './definitions';

// In-memory store
let orders: Order[] = [];
let menu: MenuItem[] = [
  { id: 1, name: 'Maple Matcha Latte', inStock: true, category: 'Lattes' },
  { id: 2, name: 'Dalgona Whipped Coffee', inStock: true, category: 'Lattes' },
  { id: 3, name: 'London Fog', inStock: true, category: 'Teas' },
  { id: 4, name: 'Apple Cider Chai', inStock: true, category: 'Teas' },
];
let nextMenuItemId = 5;

export const getMenu = async (): Promise<MenuItem[]> => {
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 100));
  return Promise.resolve([...menu]);
};

export const updateMenu = async (updatedMenu: MenuItem[]): Promise<MenuItem[]> => {
  await new Promise(resolve => setTimeout(resolve, 100));
  menu = updatedMenu;
  return Promise.resolve([...menu]);
};

export const addMenuItem = async (name: string, category: string): Promise<MenuItem> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const newItem: MenuItem = {
        id: nextMenuItemId++,
        name,
        category,
        inStock: true,
    };
    menu.push(newItem);
    return Promise.resolve(newItem);
}

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
