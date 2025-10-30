'use client';
    
import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useUser } from '../provider';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/**
 * React hook to subscribe to a single Firestore document in real-time.
 * Handles nullable references.
 * 
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {DocumentReference<DocumentData> | null | undefined} docRef -
 * The Firestore DocumentReference. Waits if null/undefined.
 * @returns {UseDocResult<T>} Object with data, isLoading, error.
 */
export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const { isUserLoading, user } = useUser();

  useEffect(() => {
    // The query should only run when auth is no longer loading AND we have a user.
    if (isUserLoading || !user) {
      setIsLoading(true); // Keep loading until we have an authenticated user.
      return;
    }

    // The query should also only run if the ref itself is ready.
    if (!memoizedDocRef) {
      setIsLoading(false); // Not loading if there's no ref to fetch.
      return;
    }

    setIsLoading(true);
    setError(null);

    // Track if we should retry on permission errors (for handling auth token propagation race condition)
    let hasRetried = false;
    let unsubscribe: (() => void) | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;

    const setupListener = () => {
      unsubscribe = onSnapshot(
        memoizedDocRef,
        (snapshot: DocumentSnapshot<DocumentData>) => {
          if (snapshot.exists()) {
            setData({ ...(snapshot.data() as T), id: snapshot.id });
          } else {
            // Document does not exist
            setData(null);
          }
          setError(null); // Clear any previous error on successful snapshot (even if doc doesn't exist)
          setIsLoading(false);
        },
        (error: FirestoreError) => {
          // If this is a permission error and we haven't retried yet, it might be a race condition
          // where the auth token hasn't propagated to Firestore yet. Retry once after a short delay.
          if (error.code === 'permission-denied' && !hasRetried) {
            hasRetried = true;
            console.log('Permission denied on first attempt, retrying after auth token propagation...');

            retryTimeout = setTimeout(() => {
              if (unsubscribe) {
                unsubscribe();
              }
              setupListener();
            }, 500); // Wait 500ms for auth token to propagate

            return;
          }

          // If we've already retried or it's not a permission error, emit the error
          const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: memoizedDocRef.path,
          })

          setError(contextualError)
          setData(null)
          setIsLoading(false)

          // trigger global error propagation
          errorEmitter.emit('permission-error', contextualError);
        }
      );
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [memoizedDocRef, isUserLoading, user]); // Re-run if the memoizedDocRef or user state changes.

  return { data, isLoading, error };
}
