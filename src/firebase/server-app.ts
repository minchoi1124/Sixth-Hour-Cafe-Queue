'use server';

import { initializeApp, getApps, getApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';

// This file is used to initialize the Firebase Admin SDK on the server-side.

let app: App;
if (getApps().length === 0) {
  app = initializeApp({
    projectId: firebaseConfig.projectId,
  });
} else {
  app = getApp();
}

const firestore: Firestore = getFirestore(app);

export async function initializeServerApp() {
  // This function now simply returns the already-initialized instance.
  // The 'async' keyword is required for Server Actions.
  return { firestore };
}
