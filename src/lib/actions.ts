'use server';

import { revalidatePath } from 'next/cache';
import { addOrder, completeOrder, getMenu, updateMenu, addMenuItem, addCategory, updateCategory, deleteCategory } from './data';
import type { MenuItem, NewOrder } from './definitions';
import { z } from 'zod';
import { FirestorePermissionError } from '@/firebase/errors';

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
    if (e instanceof FirestorePermissionError) {
        throw e;
    }
    console.error('Failed to complete order:', e);
    // Optionally, return an error to the client
  }
}

export async function saveMenu(formData: FormData) {
  const currentMenu = await getMenu();
  const updatedMenu: MenuItem[] = [];

  for (const item of currentMenu) {
      const name = formData.get(`item-${item.id}-name`) as string;
      const category = formData.get(`item-${item.id}-category`) as string;
      const inStock = formData.get(`item-${item.id}-instock`) === 'on';

      if (name && category) {
          updatedMenu.push({
              ...item,
              name: name.trim(),
              category: category.trim(),
              inStock: inStock,
          });
      }
  }

  try {
    await updateMenu(updatedMenu);
    revalidatePath('/staff/menu');
    revalidatePath('/');
  } catch (e) {
    handlePermissionError(e);
  }
}

const AddDrinkSchema = z.object({
    name: z.string().trim().min(2, 'Drink name must be at least 2 characters'),
    category: z.string().trim().min(1, 'Please select a category'),
});

export type AddDrinkFormState = {
    message?: string;
    errors?: {
        name?: string[];
        category?: string[];
    };
    success?: boolean;
}

export async function addNewDrink(prevState: AddDrinkFormState, formData: FormData): Promise<AddDrinkFormState> {
    const validatedFields = AddDrinkSchema.safeParse({
        name: formData.get('name'),
        category: formData.get('category'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Invalid data.',
            success: false,
        };
    }

    try {
        await addMenuItem(validatedFields.data.name, validatedFields.data.category);
        revalidatePath('/staff/menu');
        revalidatePath('/');
        return { message: `Added "${validatedFields.data.name}" to the menu.`, success: true };
    } catch (e) {
        if (e instanceof FirestorePermissionError) {
            throw e;
        }
        return { message: 'Failed to add new drink.', success: false };
    }
}

const CategorySchema = z.object({
    name: z.string().trim().min(2, 'Category name must be at least 2 characters.'),
});

export type CategoryFormState = {
    message?: string;
    errors?: { name?: string[] };
    success?: boolean;
};

export async function handleAddCategory(prevState: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
    const validatedFields = CategorySchema.safeParse({
        name: formData.get('name'),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Invalid category name.',
            success: false,
        };
    }

    try {
        await addCategory(validatedFields.data.name);
        // No revalidation needed, component uses real-time listener
        return { success: true, message: `Category "${validatedFields.data.name}" added.` };
    } catch (e) {
        if (e instanceof FirestorePermissionError) {
            // Re-throwing the error will be caught by Next.js error boundary
            // and displayed to the user, which is what we want for permission errors.
            throw e;
        }
        return { message: 'Failed to add category. An unexpected error occurred.', success: false };
    }
}

export async function handleUpdateCategory(formData: FormData) {
    const categoryId = formData.get('categoryId') as string;
    const newName = formData.get('name') as string;

    if (!categoryId || !newName || newName.trim().length < 2) {
        // Handle error appropriately
        console.error("Invalid data for category update");
        return;
    }

    try {
        await updateCategory(categoryId, newName.trim());
        // No revalidation needed
    } catch (e) {
        handlePermissionError(e);
    }
}

export async function handleDeleteCategory(formData: FormData) {
    const categoryId = formData.get('categoryId') as string;
    if (!categoryId) {
        console.error("Category ID not provided for deletion");
        return;
    }
    try {
        await deleteCategory(categoryId);
        // No revalidation needed
    } catch(e) {
        handlePermissionError(e);
    }
}
