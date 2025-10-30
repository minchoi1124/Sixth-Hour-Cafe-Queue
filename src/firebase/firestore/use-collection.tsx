
'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useUser } from '../provider';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/* Internal implementation of Query:
  https://github.com/firebase/firebase-js-sdk/blob/c5f08a9bc5da0d2b0207802c972d53724ccef055/packages/firestore/src/lite-api/reference.ts#L143
*/
export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * Handles nullable references/queries.
 * 
 *
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *  
 * @template T Optional type for document data. Defaults to any.
 * @param {CollectionReference<DocumentData> | Query<DocumentData> | null | undefined} targetRefOrQuery -
 * The Firestore CollectionReference or Query. Waits if null/undefined.
 * @returns {UseCollectionResult<T>} Object with data, isLoading, error.
 */
export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const { isUserLoading, user } = useUser();

  useEffect(() => {
    // This is the primary guard clause.
    // We must wait until authentication is no longer loading AND we have a user.
    if (isUserLoading) {
      // Reflect the auth loading state. Keep loading until auth is resolved.
      setIsLoading(true);
      setData(null);
      setError(null);
      return;
    }

    if (!user) {
        setIsLoading(false);
        setData(null);
        setError(new Error("User not authenticated. Cannot fetch collection."));
        return;
    }

    // If we have a user but no query, we are done loading and there's no data.
    if (!memoizedTargetRefOrQuery) {
        setIsLoading(false);
        setData([]); // Return empty array instead of null for consistency
        setError(null);
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
        memoizedTargetRefOrQuery,
        (snapshot: QuerySnapshot<DocumentData>) => {
          const results: ResultItemType[] = [];
          for (const doc of snapshot.docs) {
            results.push({ ...(doc.data() as T), id: doc.id });
          }
          setData(results);
          setError(null);
          setIsLoading(false);
        },
        (error: FirestoreError) => {
          const path: string =
            memoizedTargetRefOrQuery.type === 'collection'
              ? (memoizedTargetRefOrQuery as CollectionReference).path
              : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString()

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
            operation: 'list',
            path,
          })

          setError(contextualError)
          setData(null)
          setIsLoading(false)

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
  }, [memoizedTargetRefOrQuery, isUserLoading, user]);
  
  if (memoizedTargetRefOrQuery && (memoizedTargetRefOrQuery as any).__memo !== true) {
    console.warn('The query or reference passed to useCollection was not created with useMemoFirebase. This can lead to infinite loops and performance issues.', memoizedTargetRefOrQuery);
  }

  return { data, isLoading, error };
}
