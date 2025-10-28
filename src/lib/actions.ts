'use server';

import { revalidatePath } from 'next/cache';
import { addOrder, completeOrder, getMenu, updateMenu } from './data';
import type { MenuItem } from './definitions';
import { z } from 'zod';

const OrderSchema = z.object({
  customerName: z.string().trim().min(2, 'Please enter a name (at least 2 characters)'),
  itemIds: z.array(z.coerce.number()).min(1, 'Please select at least one drink'),
});

type OrderFormState = {
  message?: string;
  errors?: {
    customerName?: string[];
    itemIds?: string[];
  };
  success?: boolean;
};

export async function submitOrder(prevState: OrderFormState, formData: FormData): Promise<OrderFormState> {
  const validatedFields = OrderSchema.safeParse({
    customerName: formData.get('customerName'),
    itemIds: formData.getAll('itemIds'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Invalid order.',
      success: false,
    };
  }

  const allMenuItems = await getMenu();
  const selectedItems = allMenuItems.filter(item => validatedFields.data.itemIds.includes(item.id));

  try {
    await addOrder({
      customerName: validatedFields.data.customerName,
      items: selectedItems,
    });

    revalidatePath('/staff');
    revalidatePath('/api/orders');
    return { message: `Thanks, ${validatedFields.data.customerName}! Your order is in.`, success: true };
  } catch (e) {
    return { message: 'Failed to submit order.', success: false };
  }
}

export async function markOrderAsCompleted(orderId: string) {
  try {
    await completeOrder(orderId);
    revalidatePath('/staff');
    revalidatePath('/api/orders');
  } catch (e) {
    console.error('Failed to complete order:', e);
    // Optionally, return an error to the client
  }
}

export async function saveMenu(formData: FormData) {
  const currentMenu = await getMenu();
  const updatedMenu: MenuItem[] = currentMenu.map(item => ({
    ...item,
    inStock: formData.get(`item-${item.id}-instock`) === 'on',
  }));

  try {
    await updateMenu(updatedMenu);
    revalidatePath('/staff/menu');
    revalidatePath('/');
  } catch (e) {
    console.error('Failed to save menu:', e);
  }
}
