
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
  // We cannot get auth from useAuth() here because this component is inside the provider it depends on.
  // We get it from the initialized app instance directly. Note this is a safe, non-hook way to get auth.
  const auth = getAuth(initializeFirebase().firebaseApp);
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    // Initiate sign-in if no user is present and we are not in the initial loading state.
    if (!user && !isUserLoading) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  // While the initial user state is being determined OR if there's no user yet, show a loading screen.
  // This is the main gate that prevents child components from rendering and fetching data prematurely.
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
