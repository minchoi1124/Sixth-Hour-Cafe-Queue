import { SignJWT, generateKeyPair, importPKCS8 } from 'jose';
import { getServiceAccount } from '@/lib/firebase-admin';

// A Firebase custom token, signed with the service account key. Built with
// `jose` rather than firebase-admin/auth's createCustomToken because that module
// pulls in jwks-rsa, which hits the same serverless ESM crash noted in
// firebase-admin.ts. The format is Firebase's documented custom-token JWT:
// https://firebase.google.com/docs/auth/admin/create-custom-tokens#create_custom_tokens_using_a_third-party_jwt_library

const AUDIENCE =
  'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';

// The Auth emulator doesn't check the signature, so local preview
// (`npm run dev:emulator`) signs with a throwaway key instead of needing the
// real service account.
let emulatorKey: Promise<CryptoKey> | null = null;
async function signingKey(): Promise<{ key: CryptoKey; email: string }> {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    emulatorKey ??= generateKeyPair('RS256').then((pair) => pair.privateKey);
    return { key: await emulatorKey, email: 'emulator@example.com' };
  }
  const account = getServiceAccount();
  return { key: await importPKCS8(account.private_key, 'RS256'), email: account.client_email };
}

export async function createCustomToken(uid: string, claims: Record<string, unknown>): Promise<string> {
  const account = await signingKey();
  const key = account.key;
  return new SignJWT({ uid, claims })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(account.email)
    .setSubject(account.email)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    // Only how long the token may be exchanged for a sign-in. The sign-in
    // itself lasts until the device signs out or the passcode changes.
    .setExpirationTime('5m')
    .sign(key);
}
