import { NextRequest } from 'next/server';
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from 'jose';
import { STAFF_LOCATION_CLAIM } from '@/lib/staff-passcode';

// Firebase ID tokens, verified with `jose` for the same reason as App Check
// tokens (see app-check-server.ts): firebase-admin/auth crashes the serverless
// runtime. This is Firebase's documented check:
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library

const ID_TOKEN_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export type SignedInAccount = { uid: string; email: string };

async function payloadOf(token: string): Promise<JWTPayload | null> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error('[id-token] NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set');
    return null;
  }
  try {
    // The Auth emulator (`npm run dev:emulator`) doesn't sign its tokens.
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      const payload = decodeJwt(token);
      return payload.aud === projectId ? payload : null;
    }
    const { payload } = await jwtVerify(token, ID_TOKEN_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    return payload;
  } catch (e) {
    console.error('[id-token] verification failed:', (e as Error)?.message);
    return null;
  }
}

/**
 * The owner account making this request, from its `Authorization: Bearer`
 * ID token, or null. Phones signed in with a staff passcode don't count: they
 * have no account to make an owner of.
 */
export async function signedInAccount(req: NextRequest): Promise<SignedInAccount | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const payload = await payloadOf(token);
  if (!payload || typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
  if (typeof payload[STAFF_LOCATION_CLAIM] === 'string') return null;
  if (typeof payload.email !== 'string' || payload.email.length === 0) return null;
  return { uid: payload.sub, email: payload.email };
}
