'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getDoc } from 'firebase/firestore';
import { useFirestore, useUser } from './provider';
import { memberDoc, userDoc } from '@/lib/cafe-paths';
import type { MemberRole, UserLocation } from '@/lib/definitions';
import { STAFF_LOCATION_CLAIM, STAFF_PASSCODE_VERSION_CLAIM } from '@/lib/staff-passcode';

export type CafeRole = MemberRole;

interface CafeContextValue {
  cafeId: string | null;
  role: CafeRole | null;
}

const CafeContext = createContext<CafeContextValue>({ cafeId: null, role: null });

type ResolvedCafe = {
  cafeId: string | null;
  role: CafeRole | null;
  /** For staff: the passcode version this device signed in under. */
  passcodeVersion: number | null;
  loading: boolean;
};

const NONE: ResolvedCafe = { cafeId: null, role: null, passcodeVersion: null, loading: false };

/**
 * Resolves which location the signed-in user works at:
 *  - a staff device signed in with a passcode carries the location (and the passcode
 *    version) as claims on its token;
 *  - an owner's `users/{uid}` names the location, and
 *    `locations/{locationId}/members/{uid}` with role 'owner' confirms it.
 * Anything else resolves to none: a brand-new owner who must onboard, or an
 * account left over from the old staff invites. Intended for the staff layout,
 * which then supplies CafeProvider and signs out a staff device whose passcode has
 * since changed.
 */
export function useResolveCafe(): ResolvedCafe {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [state, setState] = useState<ResolvedCafe>({ ...NONE, loading: true });

  useEffect(() => {
    if (isUserLoading) {
      setState({ ...NONE, loading: true });
      return;
    }
    if (!user || user.isAnonymous) {
      setState(NONE);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { claims } = await user.getIdTokenResult();
        if (cancelled) return;
        const staffLocation = claims[STAFF_LOCATION_CLAIM];
        if (typeof staffLocation === 'string') {
          const version = claims[STAFF_PASSCODE_VERSION_CLAIM];
          setState({
            cafeId: staffLocation,
            role: 'staff',
            passcodeVersion: typeof version === 'number' ? version : 0,
            loading: false,
          });
          return;
        }

        const pointer = await getDoc(userDoc(firestore, user.uid));
        if (cancelled) return;
        if (pointer.exists()) {
          const { locationId } = pointer.data() as UserLocation;
          const membership = await getDoc(memberDoc(firestore, locationId, user.uid));
          if (cancelled) return;
          if (membership.exists() && membership.get('role') === 'owner') {
            setState({ cafeId: locationId, role: 'owner', passcodeVersion: null, loading: false });
            return;
          }
        }
        setState(NONE);
      } catch (e) {
        console.error('Failed to resolve cafe membership:', e);
        if (!cancelled) setState(NONE);
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
