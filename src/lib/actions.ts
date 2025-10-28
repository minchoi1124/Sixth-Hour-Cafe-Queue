'use server';

import { completeOrder } from './data';
import { FirestorePermissionError } from '@/firebase/errors';

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
