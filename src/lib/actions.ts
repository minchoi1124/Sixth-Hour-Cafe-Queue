
'use server';

import { completeOrder, getCompletedOrders, clearCompletedOrders as clearHistoryData, archiveSingleOrder } from './data';
import { revalidatePath } from 'next/cache';
import { FirestorePermissionError } from '@/firebase/errors';
import type { Order } from './definitions';

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

export async function markOrderAsCompleted(orderId: string) {
  try {
    await completeOrder(orderId);
    // No revalidation needed due to real-time updates
  } catch (e) {
    handlePermissionError(e);
  }
}

export async function fetchCompletedOrders(): Promise<Order[]> {
    try {
        const orders = await getCompletedOrders();
        return orders;
    } catch (e) {
        // In a real app, you might want to log this error to a service
        console.error("Failed to fetch completed orders:", e);
        // Return an empty array or re-throw the error depending on how you want to handle it
        return [];
    }
}

export async function clearCompletedOrders() {
  try {
    await clearHistoryData();
  } catch (e) {
    handlePermissionError(e);
  }
}

export async function archiveOrder(orderId: string) {
  try {
    await archiveSingleOrder(orderId);
  } catch (e) {
    handlePermissionError(e);
  }
}
