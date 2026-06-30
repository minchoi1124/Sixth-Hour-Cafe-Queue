import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAppCheck, AppCheck } from 'firebase-admin/app-check';

// Initialization is lazy so importing this module (e.g. during `next build` page
// data collection) doesn't throw when FIREBASE_SERVICE_ACCOUNT is absent. The
// credential is only required when a server request actually reads/writes.
function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT environment variable is not set. ' +
      'Add the Firebase service account JSON as a single-line string in your environment.'
    );
  }

  return initializeApp({
    credential: cert(JSON.parse(serviceAccount)),
  });
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminAppCheck(): AppCheck {
  return getAppCheck(getAdminApp());
}
