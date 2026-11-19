import type { Firestore } from 'firebase-admin/firestore';

// Test locations: ordinary locations with `hidden: true`, which keeps them out
// of the location picker (src/lib/data.ts). Only the admin (src/lib/admin.ts)
// makes them, through onboarding (/onboarding?add=1&test=1), and only the admin
// clears them, through /api/admin/clear-test-location, which runs this.

export type TestLocationErrorCode = 'not-found' | 'not-owner' | 'not-hidden';

export class TestLocationError extends Error {
  constructor(readonly code: TestLocationErrorCode) {
    super(code);
  }
}

export type ClearedTestLocation = { orders: number; sessions: number };

/**
 * Deletes a test location's orders and sessions (scheduled ones too), closes
 * it and restarts its order numbers at 1. The menu, presets, recipes, passcode
 * and owners stay. Refuses any location that isn't hidden, so a real
 * location's history can never go this way, and any the caller doesn't own.
 */
export async function clearTestLocation(
  db: Firestore,
  locationId: string,
  uid: string,
): Promise<ClearedTestLocation> {
  const location = db.doc(`locations/${locationId}`);
  const [snap, member] = await Promise.all([location.get(), location.collection('members').doc(uid).get()]);
  if (!snap.exists) throw new TestLocationError('not-found');
  if (member.get('role') !== 'owner') throw new TestLocationError('not-owner');
  if (snap.get('hidden') !== true) throw new TestLocationError('not-hidden');

  const orders = location.collection('orders');
  const sessions = location.collection('sessions');
  const [orderCount, sessionCount] = await Promise.all([orders.count().get(), sessions.count().get()]);

  // Close it first, so the ordering page stops taking orders before they go.
  // activeSessionId and liveMenu always change together (src/lib/sessions.ts).
  await location.update({ activeSessionId: null, liveMenu: null });
  await Promise.all([
    db.recursiveDelete(orders),
    db.recursiveDelete(sessions),
    location.collection('private').doc('orderCounter').delete(),
  ]);
  return { orders: orderCount.data().count, sessions: sessionCount.data().count };
}
