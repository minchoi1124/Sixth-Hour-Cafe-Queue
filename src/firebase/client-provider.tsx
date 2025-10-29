'use client';

import React, { useMemo, type ReactNode, useEffect } from 'react';
import { FirebaseProvider, useUser } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from './non-blocking-login';
import { getAuth } from 'firebase/auth';
import { Logo } from '@/components/Logo';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * This internal component handles the app's rendering logic based on auth state.
 * It initiates anonymous sign-in and only renders children when a user is authenticated.
 */
function AuthHandler({ children }: { children: ReactNode }) {
  const auth = getAuth(initializeFirebase().firebaseApp);
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    // Initiate sign-in if no user is present.
    // The onAuthStateChanged listener in FirebaseProvider will handle the resulting user state.
    if (!user && !isUserLoading) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // While the initial user state is being determined, show a full-page loading screen.
  // This prevents any child components from attempting to fetch data before auth is ready.
  if (isUserLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
        <Logo className="w-24 h-24 mb-4 animate-pulse" />
        <h1 className="text-4xl font-bold">Connecting...</h1>
      </div>
    );
  }

  // Once loading is complete, if there's a user, render the application.
  if (user) {
    return <>{children}</>;
  }

  // If there's no user and we are not loading, it means sign-in is in progress
  // or has failed. We continue to show a loading/connecting state.
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <Logo className="w-24 h-24 mb-4 animate-pulse" />
      <h1 className="text-4xl font-bold">Connecting...</h1>
    </div>
  );
}


export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
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
