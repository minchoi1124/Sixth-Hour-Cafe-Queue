'use client';

import React, { useMemo, type ReactNode, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { FirebaseProvider, useAuth } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from './non-blocking-login';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []);

  // Customers ordering at /order/* are signed in anonymously so they can place
  // orders under Firestore rules. Owner areas (/login, /onboarding, /staff) use
  // real email/Google accounts, so we must NOT auto-create an anonymous session
  // there — that would mask the signed-in owner.
  const AuthHandler = () => {
    const auth = useAuth(); // Use the hook to get the auth instance.
    const pathname = usePathname();
    const isCustomerRoute = pathname?.startsWith('/order');

    useEffect(() => {
        if (isCustomerRoute && auth && !auth.currentUser) {
            initiateAnonymousSignIn(auth);
        }
    }, [auth, isCustomerRoute]);

    return null; // This component doesn't render anything.
  };

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      <AuthHandler />
      {children}
    </FirebaseProvider>
  );
}
