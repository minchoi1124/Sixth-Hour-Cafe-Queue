'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getDoc } from 'firebase/firestore';
import { useFirestore, useUser } from './provider';
import { memberDoc, userDoc } from '@/lib/cafe-paths';
import type { MemberRole, UserLocation } from '@/lib/definitions';

export type CafeRole = MemberRole;

interface CafeContextValue {
  cafeId: string | null;
  role: CafeRole | null;
}

const CafeContext = createContext<CafeContextValue>({ cafeId: null, role: null });

/**
 * Resolves which location the signed-in user belongs to:
 *  - `users/{uid}` names the location, and
 *  - `locations/{locationId}/members/{uid}` confirms access and gives the role.
 * The member doc is the authority; a pointer whose membership was removed
 * resolves to none, the same as a brand-new user who must onboard or join.
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
        const pointer = await getDoc(userDoc(firestore, user.uid));
        if (cancelled) return;
        if (pointer.exists()) {
          const { locationId } = pointer.data() as UserLocation;
          const membership = await getDoc(memberDoc(firestore, locationId, user.uid));
          if (cancelled) return;
          if (membership.exists()) {
            setState({ cafeId: locationId, role: membership.get('role') as CafeRole, loading: false });
            return;
          }
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

/** The current user's resolved location id. */
export const useCafeId = (): string | null => useContext(CafeContext).cafeId;

/** Whether the current user is the 'owner' or 'staff' of the active cafe. */
export const useCafeRole = (): CafeRole | null => useContext(CafeContext).role;
