'use server';

import { revalidatePath } from 'next/cache';
import { addOrder, completeOrder } from './data';
import type { NewOrder } from './definitions';
import { z } from 'zod';
import { FirestorePermissionError } from '@/firebase/errors';
import { getMenu } from './data';

const OrderSchema = z.object({
  customerName: z.string().trim().min(2, 'Please enter a name (at least 2 characters)'),
  itemId: z.string().min(1, 'Please select a drink'), // ID is now a string
});

export type OrderFormState = {
  message?: string;
  errors?: {
    customerName?: string[];
    itemId?: string[];
  };
  success?: boolean;
};

// Helper function to handle throwing permission errors in server actions
function handlePermissionError(error: unknown) {
  if (error instanceof FirestorePermissionError) {
    // We re-throw the error to be caught by the framework's error boundary.
    // The FirebaseErrorListener on the client will not catch server-side errors.
    throw error;
  }
  // For other errors, we can log them or handle them differently
  console.error("An unexpected error occurred:", error);
  throw new Error("An unexpected server error occurred.");
}


export async function submitOrder(prevState: OrderFormState, formData: FormData): Promise<OrderFormState> {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network latency

  const validatedFields = OrderSchema.safeParse({
    customerName: formData.get('customerName'),
    itemId: formData.get('itemId'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Invalid order.',
      success: false,
    };
  }

  const allMenuItems = await getMenu();
  const selectedItem = allMenuItems.find(item => validatedFields.data.itemId === item.id);

  if (!selectedItem) {
    return {
      errors: {
        itemId: ['Invalid drink selected.'],
      },
      message: 'Invalid order.',
      success: false,
    };
  }

  try {
    const newOrder: NewOrder = {
      customerName: validatedFields.data.customerName,
      items: [{ id: selectedItem.id, name: selectedItem.name }],
    };
    await addOrder(newOrder);

    // No revalidation needed for staff page due to real-time updates
    return { message: `Thanks, ${validatedFields.data.customerName}! Your order is in.`, success: true };
  } catch (e) {
    if (e instanceof FirestorePermissionError) {
        throw e;
    }
    return { message: 'Failed to submit order.', success: false };
  }
}

export async function markOrderAsCompleted(orderId: string) {
  try {
    await completeOrder(orderId);
    // No revalidation needed due to real-time updates
  } catch (e) {
    handlePermissionError(e);
  }
}
