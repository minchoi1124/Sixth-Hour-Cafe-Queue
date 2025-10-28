'use server';

import { initializeApp, getApps, getApp, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';

// IMPORTANT: DO NOT MODIFY THIS FILE
// This file is used to initialize the Firebase Admin SDK on the server-side.
// It is a separate entry point from the client-side Firebase initialization.

function getServerApp(): App {
    if (getApps().length) {
        return getApp();
    }
    return initializeApp({
        // projectId is used by the Firestore client to find the project
        // on the server.
        projectId: firebaseConfig.projectId,
    });
}

export function initializeServerApp() {
    const firebaseApp = getServerApp();
    return {
        firestore: getFirestore(firebaseApp),
    };
}
