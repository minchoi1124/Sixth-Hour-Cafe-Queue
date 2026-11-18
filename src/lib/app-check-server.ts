import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// App Check tokens are verified with `jose` directly rather than the
// firebase-admin app-check SDK: that SDK pulls in jwks-rsa/jose via require(),
// which breaks in the serverless ESM runtime (ERR_REQUIRE_ESM).

// Google's public keys for App Check tokens. createRemoteJWKSet caches them.
const APP_CHECK_JWKS = createRemoteJWKSet(
  new URL('https://firebaseappcheck.googleapis.com/v1/jwks')
);

// The Firebase project number is the same value as the messaging sender ID.
const PROJECT_NUMBER = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;

async function isValidAppCheckToken(token: string, tag: string): Promise<boolean> {
  if (!PROJECT_NUMBER) {
    console.error(`[${tag}] App Check skipped: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID (project number) is not set`);
    return false;
  }
  try {
    await jwtVerify(token, APP_CHECK_JWKS, {
      issuer: `https://firebaseappcheck.googleapis.com/${PROJECT_NUMBER}`,
      audience: `projects/${PROJECT_NUMBER}`,
      algorithms: ['RS256'],
    });
    return true;
  } catch (e) {
    console.error(`[${tag}] App Check token verification failed:`, (e as Error)?.message);
    return false;
  }
}

/**
 * Checks the request's App Check token (bot protection). Returns an error
 * response to send back, or null when the request may go on. Enforced in
 * production only, so local dev works without a reCAPTCHA key.
 */
export async function rejectWithoutAppCheck(req: NextRequest, tag: string): Promise<NextResponse | null> {
  if (process.env.NODE_ENV !== 'production') return null;
  const token = req.headers.get('X-Firebase-AppCheck');
  if (!token) {
    console.error(`[${tag}] Missing X-Firebase-AppCheck header`);
    return NextResponse.json({ error: 'Missing App Check token' }, { status: 401 });
  }
  if (!(await isValidAppCheckToken(token, tag))) {
    return NextResponse.json({ error: 'Invalid App Check token' }, { status: 401 });
  }
  return null;
}
