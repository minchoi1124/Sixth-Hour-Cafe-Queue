'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getDoc, onSnapshot } from 'firebase/firestore';
import { useFirestore, useUser } from './provider';
import { memberDoc, pointerLocationIds, userDoc } from '@/lib/cafe-paths';
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
  /** For owners: every location the account lists (may include ones it no longer owns). */
  locationIds: string[];
  loading: boolean;
};

const NONE: ResolvedCafe = { cafeId: null, role: null, passcodeVersion: null, locationIds: [], loading: false };

/**
 * Resolves which location the signed-in user works at:
 *  - a staff device signed in with a passcode carries the location (and the passcode
 *    version) as claims on its token;
 *  - an owner's `users/{uid}` names the location it's on, and
 *    `locations/{locationId}/members/{uid}` with role 'owner' confirms it.
 * Anything else resolves to none: a brand-new owner who must onboard, or an
 * account left over from the old staff invites. The owner's pointer is
 * watched, so switching locations (or being removed from one) takes effect
 * straight away. Intended for the staff layout, which then supplies
 * CafeProvider and signs out a staff device whose passcode has since changed.
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
    let unsubscribe: (() => void) | null = null;
    // Each pointer change starts a new membership check; only the latest counts.
    let check = 0;

    (async () => {
      const { claims } = await user.getIdTokenResult();
      if (cancelled) return;
      const staffLocation = claims[STAFF_LOCATION_CLAIM];
      if (typeof staffLocation === 'string') {
        const version = claims[STAFF_PASSCODE_VERSION_CLAIM];
        setState({
          cafeId: staffLocation,
          role: 'staff',
          passcodeVersion: typeof version === 'number' ? version : 0,
          locationIds: [],
          loading: false,
        });
        return;
      }

      unsubscribe = onSnapshot(
        userDoc(firestore, user.uid),
        async (pointer) => {
          const mine = ++check;
          if (!pointer.exists()) {
            setState(NONE);
            return;
          }
          const data = pointer.data() as UserLocation;
          setState((prev) => ({ ...prev, loading: prev.cafeId !== data.locationId }));
          try {
            const membership = await getDoc(memberDoc(firestore, data.locationId, user.uid));
            if (cancelled || mine !== check) return;
            if (membership.exists() && membership.get('role') === 'owner') {
              setState({
                cafeId: data.locationId,
                role: 'owner',
                passcodeVersion: null,
                locationIds: pointerLocationIds(data),
                loading: false,
              });
              return;
            }
          } catch (e) {
            console.error('Failed to resolve cafe membership:', e);
            if (cancelled || mine !== check) return;
          }
          setState(NONE);
        },
        (e) => {
          console.error('Failed to read the account pointer:', e);
          if (!cancelled) setState(NONE);
        },
      );
    })().catch((e) => {
      console.error('Failed to resolve cafe membership:', e);
      if (!cancelled) setState(NONE);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
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
