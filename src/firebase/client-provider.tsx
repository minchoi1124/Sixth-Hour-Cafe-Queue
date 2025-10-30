
'use client';

import React, { useMemo, type ReactNode, useEffect, useState, useRef } from 'react';
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
  const { user, isUserLoading } = useUser();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const hasInitiatedSignIn = useRef(false);

  useEffect(() => {
    // Initiate sign-in if no user is present and we are not in the initial loading state.
    if (!user && !isUserLoading && !hasInitiatedSignIn.current) {
      hasInitiatedSignIn.current = true;
      setIsSigningIn(true);
      // getAuth() is safe to call here because we are inside the FirebaseProvider
      initiateAnonymousSignIn(getAuth(initializeFirebase().firebaseApp));
    }

    // Once we have a user, sign-in is complete
    if (user) {
      setIsSigningIn(false);
    }
  }, [user, isUserLoading]);

  // While the initial user state is being determined OR if there's no user yet (because sign-in is in progress),
  // show a loading screen. This is the main gate that prevents child components from rendering prematurely.
  if (isUserLoading || !user || isSigningIn) {
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
