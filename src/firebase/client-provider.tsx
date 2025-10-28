'use client';

import React, { useMemo, type ReactNode, useEffect } from 'react';
import { FirebaseProvider, useAuth } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from './non-blocking-login';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []); 

  // This new component handles the anonymous sign-in logic.
  const AuthHandler = () => {
    const auth = useAuth(); // Use the hook to get the auth instance.
    useEffect(() => {
        // When the component mounts, check if a user is signed in.
        // If not, initiate the anonymous sign-in process.
        if (auth && !auth.currentUser) {
            initiateAnonymousSignIn(auth);
        }
    }, [auth]); // Dependency on the auth instance.

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
