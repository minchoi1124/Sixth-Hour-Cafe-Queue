import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { getAdminDb } from '@/lib/firebase-admin';

// Order creation runs server-side via the Admin SDK so the public real-time
// listeners no longer need App Check enforcement on Firestore (which was adding
// reCAPTCHA latency to every read). Bot protection is preserved here by verifying
// the App Check token before writing. Firestore rules deny client-side order
// creates entirely, so this route is the only path to place an order.
//
// We verify the App Check JWT with `jose` directly rather than the firebase-admin
// app-check SDK: that SDK pulls in jwks-rsa/jose via require(), which breaks in
// the serverless ESM runtime (ERR_REQUIRE_ESM).

type IncomingItem = {
  id: unknown;
  name: unknown;
  modifications: unknown;
};

// Google's public keys for App Check tokens. createRemoteJWKSet caches them.
const APP_CHECK_JWKS = createRemoteJWKSet(
  new URL('https://firebaseappcheck.googleapis.com/v1/jwks')
);

// The Firebase project number is the same value as the messaging sender ID.
const PROJECT_NUMBER = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;

async function isValidAppCheckToken(token: string): Promise<boolean> {
  if (!PROJECT_NUMBER) return false;
  try {
    await jwtVerify(token, APP_CHECK_JWKS, {
      issuer: `https://firebaseappcheck.googleapis.com/${PROJECT_NUMBER}`,
      audience: `projects/${PROJECT_NUMBER}`,
      algorithms: ['RS256'],
    });
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // --- App Check verification (bot protection) ---
  // Enforced in production only, so local dev works without a reCAPTCHA key.
  if (process.env.NODE_ENV === 'production') {
    const appCheckToken = req.headers.get('X-Firebase-AppCheck');
    if (!appCheckToken || !(await isValidAppCheckToken(appCheckToken))) {
      return NextResponse.json({ error: 'Invalid App Check token' }, { status: 401 });
    }
  }

  // --- Parse + validate the order payload ---
  let body: { cafeId?: unknown; customerName?: unknown; items?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { cafeId, customerName, items } = body;

  if (typeof cafeId !== 'string' || cafeId.length === 0) {
    return NextResponse.json({ error: 'Invalid cafeId' }, { status: 400 });
  }
  if (
    typeof customerName !== 'string' ||
    customerName.trim().length < 1 ||
    customerName.length > 60
  ) {
    return NextResponse.json({ error: 'Invalid customer name' }, { status: 400 });
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 25) {
    return NextResponse.json({ error: 'Invalid items' }, { status: 400 });
  }

  const sanitizedItems = [];
  for (const raw of items as IncomingItem[]) {
    if (
      !raw ||
      typeof raw.id !== 'string' ||
      typeof raw.name !== 'string' ||
      !Array.isArray(raw.modifications) ||
      !raw.modifications.every((m) => typeof m === 'string')
    ) {
      return NextResponse.json({ error: 'Invalid item shape' }, { status: 400 });
    }
    sanitizedItems.push({
      id: raw.id,
      name: raw.name,
      modifications: raw.modifications as string[],
    });
  }

  // --- Confirm the cafe exists before writing ---
  const adminDb = getAdminDb();
  const cafeSnap = await adminDb.doc(`cafes/${cafeId}`).get();
  if (!cafeSnap.exists) {
    return NextResponse.json({ error: 'Cafe not found' }, { status: 404 });
  }

  // --- Write the order ---
  const ref = await adminDb.collection(`cafes/${cafeId}/orders`).add({
    customerName: customerName.trim(),
    items: sanitizedItems,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ id: ref.id }, { status: 201 });
}
