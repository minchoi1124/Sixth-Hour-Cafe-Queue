import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { getAdminDb } from '@/lib/firebase-admin';
import { orderDocId } from '@/lib/readable-ids';
import { cafeTimezone, zonedDateKey } from '@/lib/timezone';

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
  if (!PROJECT_NUMBER) {
    console.error('[orders] App Check skipped: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID (project number) is not set');
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
    console.error('[orders] App Check token verification failed:', (e as Error)?.message);
    return false;
  }
}

export async function POST(req: NextRequest) {
  // --- App Check verification (bot protection) ---
  // Enforced in production only, so local dev works without a reCAPTCHA key.
  if (process.env.NODE_ENV === 'production') {
    const appCheckToken = req.headers.get('X-Firebase-AppCheck');
    if (!appCheckToken) {
      console.error('[orders] Missing X-Firebase-AppCheck header');
      return NextResponse.json({ error: 'Missing App Check token' }, { status: 401 });
    }
    if (!(await isValidAppCheckToken(appCheckToken))) {
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

  const sanitizedItems: { id: string; name: string; modifications: string[] }[] = [];
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
  const cafeSnap = await adminDb.doc(`locations/${cafeId}`).get();
  if (!cafeSnap.exists) {
    return NextResponse.json({ error: 'Cafe not found' }, { status: 404 });
  }

  // --- Write the order ---
  // The order joins whichever session is currently running. `sessionId` is
  // written even when there is none (as null) so the staff app can find these
  // orphans with `where('sessionId', '==', null)` and adopt them when a session
  // starts — a missing field would never match that query.
  const activeSessionId = (cafeSnap.get('activeSessionId') as string | null | undefined) ?? null;

  // Readable, time-sortable id, e.g. `2026-10-24_14-32-05_min_a1b2`. `create`
  // rather than `set` so an id collision fails loudly instead of overwriting.
  const name = customerName.trim();
  const tz = cafeTimezone(cafeSnap.get('timezone') as string | undefined);
  const now = new Date();
  const ref = adminDb.doc(`locations/${cafeId}/orders/${orderDocId(now, name, tz)}`);

  // Order numbers count up from 1 each day in the cafe's timezone, so two
  // customers with the same name can be told apart. The counter lives under
  // `private/`, which only owners can read, and is bumped in the same
  // transaction as the order so no two orders share a number.
  const today = zonedDateKey(now, tz);
  const counterRef = adminDb.doc(`locations/${cafeId}/private/orderCounter`);
  const number = await adminDb.runTransaction(async (tx) => {
    const counter = await tx.get(counterRef);
    const next = counter.get('date') === today ? (counter.get('last') as number) + 1 : 1;
    tx.set(counterRef, { date: today, last: next });
    tx.create(ref, {
      customerName: name,
      items: sanitizedItems,
      status: 'pending',
      sessionId: activeSessionId,
      number: next,
      createdAt: FieldValue.serverTimestamp(),
    });
    return next;
  });

  return NextResponse.json({ id: ref.id, number }, { status: 201 });
}
