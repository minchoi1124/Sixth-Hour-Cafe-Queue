
'use client';

import React, { useMemo, type ReactNode, useEffect, useRef } from 'react';
import { FirebaseProvider, useUser } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { getAuth, signInAnonymously } from 'firebase/auth';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * This internal component handles anonymous sign-in in the background.
 * Unlike before, it does NOT block rendering - the app works immediately with public reads.
 * Authentication is only needed for write operations, which is enforced by Firestore security rules.
 */
function AuthHandler({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const hasInitiatedSignIn = useRef(false);

  useEffect(() => {
    // Initiate anonymous sign-in in the background (non-blocking)
    // This allows writes to work, but reads work immediately without auth
    if (!user && !isUserLoading && !hasInitiatedSignIn.current) {
      hasInitiatedSignIn.current = true;
      const auth = getAuth(initializeFirebase().firebaseApp);

      signInAnonymously(auth).catch((error) => {
        console.error("Anonymous sign-in failed:", error);
        // Don't block the app - reads will still work via public security rules
        // Writes will fail, but that's okay for a read-only experience
      });
    }
  }, [user, isUserLoading]);

  // Render immediately - don't wait for auth!
  // Public reads work without authentication thanks to Firestore security rules
  return <>{children}</>;
}


export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  // useMemo ensures that Firebase is only initialized once per render cycle.
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []); 

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      <AuthHandler>
        {children}
      </AuthHandler>
    </FirebaseProvider>
  );
}
