'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getDoc } from 'firebase/firestore';
import { useFirestore, useUser } from './provider';
import { cafeDoc, userCafeDoc } from '@/lib/cafe-paths';

export type CafeRole = 'owner' | 'staff';

interface CafeContextValue {
  cafeId: string | null;
  role: CafeRole | null;
}

const CafeContext = createContext<CafeContextValue>({ cafeId: null, role: null });

/**
 * Resolves which cafe the signed-in user belongs to:
 *  - owner  → `cafes/{uid}` exists (cafeId === uid)
 *  - staff  → `userCafes/{uid}` exists (cafeId from that doc)
 *  - none   → neither (a brand-new user who must onboard or join)
 * Intended for the staff layout, which then supplies CafeProvider.
 */
export function useResolveCafe(): {
  cafeId: string | null;
  role: CafeRole | null;
  loading: boolean;
} {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [state, setState] = useState<{ cafeId: string | null; role: CafeRole | null; loading: boolean }>({
    cafeId: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    if (isUserLoading) {
      setState({ cafeId: null, role: null, loading: true });
      return;
    }
    if (!user || user.isAnonymous) {
      setState({ cafeId: null, role: null, loading: false });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const ownDoc = await getDoc(cafeDoc(firestore, user.uid));
        if (cancelled) return;
        if (ownDoc.exists()) {
          setState({ cafeId: user.uid, role: 'owner', loading: false });
          return;
        }
        const membership = await getDoc(userCafeDoc(firestore, user.uid));
        if (cancelled) return;
        if (membership.exists()) {
          setState({ cafeId: membership.data().cafeId as string, role: 'staff', loading: false });
          return;
        }
        setState({ cafeId: null, role: null, loading: false });
      } catch (e) {
        console.error('Failed to resolve cafe membership:', e);
        if (!cancelled) setState({ cafeId: null, role: null, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isUserLoading, firestore]);

  return state;
}

export function CafeProvider({
  cafeId,
  role,
  children,
}: {
  cafeId: string | null;
  role: CafeRole | null;
  children: ReactNode;
}) {
  return <CafeContext.Provider value={{ cafeId, role }}>{children}</CafeContext.Provider>;
}

/** The current user's resolved cafeId (owner's uid or the staff member's cafe). */
export const useCafeId = (): string | null => useContext(CafeContext).cafeId;

/** Whether the current user is the 'owner' or 'staff' of the active cafe. */
export const useCafeRole = (): CafeRole | null => useContext(CafeContext).role;
