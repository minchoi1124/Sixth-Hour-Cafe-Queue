
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
  // We get auth directly from the initialized app instance because this component
  // is rendered inside the provider it would otherwise get the hook from.
  const auth = getAuth(initializeFirebase().firebaseApp);
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    // Initiate sign-in if no user is present and we are not in the initial loading state.
    if (!user && !isUserLoading) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // While the initial user state is being determined OR if there's no user yet (because sign-in is in progress),
  // show a loading screen. This is the main gate that prevents child components from rendering prematurely.
  if (isUserLoading || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
        <Logo className="w-24 h-24 mb-4 animate-pulse" />
        <h1 className="text-4xl font-bold">Connecting...</h1>
      </div>
    );
  }

  // Once loading is complete AND we have a user, render the application.
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
