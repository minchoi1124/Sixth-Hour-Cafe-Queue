'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/firebase';
import { ADMIN_CLAIM } from '@/lib/admin';

/**
 * Whether the signed-in account is the app's admin (src/lib/admin.ts), from the
 * claim on its ID token. Only decides what to show: firestore.rules and the
 * admin route check the claim themselves. A newly granted claim shows up after
 * signing out and back in.
 */
export function useIsAdmin(): boolean {
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    user
      .getIdTokenResult()
      .then(({ claims }) => {
        if (!cancelled) setIsAdmin(claims[ADMIN_CLAIM] === true);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return isAdmin;
}
