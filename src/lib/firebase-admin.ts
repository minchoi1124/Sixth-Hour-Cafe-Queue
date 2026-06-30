import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

export const adminDb = getFirestore(getAdminApp());
