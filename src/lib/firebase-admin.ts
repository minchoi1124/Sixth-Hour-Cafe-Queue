import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// NOTE: Do not import 'firebase-admin/app-check' here. It pulls in jwks-rsa/jose
// (ESM-only), which breaks the serverless require() path and crashes every page
// that only needs Firestore (e.g. the public customer page). App Check tokens
// are verified separately with `jose` directly in the order API route.

// Initialization is lazy so importing this module (e.g. during `next build` page
// data collection) doesn't throw when FIREBASE_SERVICE_ACCOUNT is absent. The
// credential is only required when a server request actually reads/writes.
export type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

/** The parsed FIREBASE_SERVICE_ACCOUNT. Also signs staff sign-in tokens. */
export function getServiceAccount(): ServiceAccount {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT environment variable is not set. ' +
      'Add the Firebase service account JSON as a single-line string in your environment.'
    );
  }
  return JSON.parse(serviceAccount) as ServiceAccount;
}

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  // Against the local emulators (`npm run dev:emulator`), which need no
  // credential. The Admin SDK routes to the emulator by this env var itself.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
  }

  return initializeApp({
    // cert() reads the raw snake_case JSON at runtime; its type only names
    // the camelCase fields.
    credential: cert(getServiceAccount() as unknown as Parameters<typeof cert>[0]),
  });
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
