'use client';
import {
  Auth, // Import Auth type for type hinting
  UserCredential,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  // Assume getAuth and app are initialized elsewhere
} from 'firebase/auth';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  // CRITICAL: Call signInAnonymously directly. Do NOT use 'await signInAnonymously(...)'.
  signInAnonymously(authInstance);
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}

/**
 * Owner sign-in/sign-up helpers.
 *
 * These intentionally return the Promise (unlike the anonymous customer flow)
 * so the login UI can await them, surface errors, and redirect on success.
 */

/** Create a new owner account with email/password. */
export function signUpWithEmail(
  authInstance: Auth,
  email: string,
  password: string,
): Promise<UserCredential> {
  return createUserWithEmailAndPassword(authInstance, email, password);
}

/** Sign an existing owner in with email/password. */
export function signInWithEmail(
  authInstance: Auth,
  email: string,
  password: string,
): Promise<UserCredential> {
  return signInWithEmailAndPassword(authInstance, email, password);
}

/** Sign in (or sign up) an owner with Google via a popup. */
export function signInWithGoogle(authInstance: Auth): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(authInstance, provider);
}
