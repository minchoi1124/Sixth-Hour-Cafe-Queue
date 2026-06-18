const fallbackFirebaseConfig = {
  projectId: 'REDACTED_FIREBASE_PROJECT_ID',
  appId: 'REDACTED_FIREBASE_APP_ID',
  apiKey: 'REDACTED_FIREBASE_API_KEY',
  authDomain: 'REDACTED_FIREBASE_PROJECT_ID.firebaseapp.com',
  measurementId: '',
  messagingSenderId: 'REDACTED_FIREBASE_SENDER_ID',
};

export const firebaseConfig = {
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    fallbackFirebaseConfig.projectId,
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    process.env.FIREBASE_APP_ID ||
    fallbackFirebaseConfig.appId,
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    fallbackFirebaseConfig.apiKey,
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    process.env.FIREBASE_AUTH_DOMAIN ||
    fallbackFirebaseConfig.authDomain,
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ||
    process.env.FIREBASE_MEASUREMENT_ID ||
    fallbackFirebaseConfig.measurementId,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    process.env.FIREBASE_MESSAGING_SENDER_ID ||
    fallbackFirebaseConfig.messagingSenderId,
};
