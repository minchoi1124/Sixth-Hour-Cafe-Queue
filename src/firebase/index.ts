'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore'
import { initializeAppCheck, ReCaptchaV3Provider, getToken, type AppCheck } from 'firebase/app-check';

let appCheckInstance: AppCheck | null = null;

/**
 * Returns a fresh App Check token for attaching to server requests (e.g. the
 * order API route), or null if App Check isn't configured (local dev without a
 * site key). Uses the cached token when available for speed.
 */
export async function getAppCheckToken(): Promise<string | null> {
  if (!appCheckInstance) return null;
  try {
    const { token } = await getToken(appCheckInstance, /* forceRefresh */ false);
    return token;
  } catch {
    return null;
  }
}

// App Check (reCAPTCHA v3) protects the public order-creation endpoint from
// bots/abuse. It only initializes in the browser when a site key is configured,
// so local development without a key still works.
function initializeAppCheckOnce(firebaseApp: FirebaseApp) {
  if (typeof window === 'undefined') return;
  // Enable App Check debug mode for local development
  if (process.env.NEXT_PUBLIC_APPCHECK_DEBUG === 'true') {
    (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) return;
  const w = window as unknown as { __appCheckInitialized?: boolean };
  if (w.__appCheckInitialized) return;
  try {
    appCheckInstance = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    w.__appCheckInitialized = true;
  } catch (e) {
    console.warn('App Check initialization failed:', e);
  }
}

export function initializeFirebase() {
  if (!getApps().length) {
    // Use the explicit config object so the app works on Vercel and other
    // non-App-Hosting environments without depending on Firebase Studio runtime injection.
    const firebaseApp = initializeApp(firebaseConfig);
    initializeAppCheckOnce(firebaseApp);
    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  const firebaseApp = getApp();
  initializeAppCheckOnce(firebaseApp);
  return getSdks(firebaseApp);
}

export function getSdks(firebaseApp: FirebaseApp) {
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);
  connectEmulatorsOnce(auth, firestore);
  return { firebaseApp, auth, firestore };
}

// Local preview against the Firebase emulators (`npm run dev:emulator`). Off
// unless NEXT_PUBLIC_USE_EMULATORS is 'true', so it never affects production.
function connectEmulatorsOnce(auth: Auth, firestore: Firestore) {
  if (process.env.NEXT_PUBLIC_USE_EMULATORS !== 'true' || typeof window === 'undefined') return;
  const w = window as unknown as { __emulatorsConnected?: boolean };
  if (w.__emulatorsConnected) return;
  w.__emulatorsConnected = true;
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
}

export * from './provider';
export * from './cafe-provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
