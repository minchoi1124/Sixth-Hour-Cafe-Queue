/**
 * Ends sessions that were left running (server only, Admin SDK).
 *
 * Runs from two places: the nightly cron (src/app/api/cron/cleanup), which
 * catches every forgotten session, and /api/orders, so a customer can't order
 * into a session that's been idle since the last cron run.
 *
 * Ending works like the End button (src/lib/sessions.ts `endSession`): the
 * stats are frozen from completed orders and the location's
 * `activeSessionId`/`liveMenu` are cleared, which closes the ordering page.
 * The differences: `endedAt` is the last order (or the start, if there were
 * none) instead of now, and `autoEnded: true` marks it in the history. Orders
 * still pending are left as they are.
 */
import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { countDrinks, tallyItems, toDate } from '@/lib/sessions';
import { idleSince, isIdle } from '@/lib/session-idle';
import type { Order } from '@/lib/definitions';

/**
 * Ends the location's running session if it's idle. Returns whether it did.
 * Safe to call at any time: a session that isn't running, or has a recent
 * order, is left alone.
 */
export async function endSessionIfIdle(
  db: Firestore,
  locationId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const locationRef = db.doc(`locations/${locationId}`);

  return db.runTransaction(async (tx) => {
    const location = await tx.get(locationRef);
    const sessionId = location.get('activeSessionId') as string | null | undefined;
    if (!location.exists || !sessionId) return false;

    const sessionRef = locationRef.collection('sessions').doc(sessionId);
    const session = await tx.get(sessionRef);
    if (!session.exists || session.get('status') !== 'active') return false;
    const startsAt = toDate(session.get('startsAt'));
    if (!startsAt) return false;

    // Cheap check first: orders stamp `lastOrderAt` on their session.
    if (!isIdle(startsAt, toDate(session.get('lastOrderAt')), now)) return false;

    // Confirm from the orders themselves (sessions started before
    // `lastOrderAt` existed don't have it), and tally the stats.
    const orders = await tx.get(locationRef.collection('orders').where('sessionId', '==', sessionId));
    let lastOrderAt: Date | null = null;
    const completed: Pick<Order, 'items'>[] = [];
    for (const order of orders.docs) {
      const createdAt = toDate(order.get('createdAt'));
      if (createdAt && (!lastOrderAt || createdAt > lastOrderAt)) lastOrderAt = createdAt;
      if (order.get('status') === 'completed') completed.push({ items: order.get('items') ?? [] });
    }
    if (!isIdle(startsAt, lastOrderAt, now)) return false;

    tx.update(sessionRef, {
      drinkCount: countDrinks(completed),
      orderCount: completed.length,
      itemCounts: tallyItems(completed),
      status: 'ended',
      endedAt: Timestamp.fromDate(idleSince(startsAt, lastOrderAt)),
      statsUpdatedAt: FieldValue.serverTimestamp(),
      autoEnded: true,
    });
    tx.update(locationRef, { activeSessionId: null, liveMenu: null });
    return true;
  });
}

/** Ends every idle session across all locations. Returns the locations ended. */
export async function endIdleSessions(db: Firestore, now: Date = new Date()): Promise<string[]> {
  const running = await db.collection('locations').where('activeSessionId', '!=', null).get();
  const ended: string[] = [];
  for (const location of running.docs) {
    try {
      if (await endSessionIfIdle(db, location.id, now)) ended.push(location.id);
    } catch (e) {
      // One bad location shouldn't stop the rest.
      console.error(`[auto-end] ${location.id}:`, (e as Error)?.message ?? e);
    }
  }
  return ended;
}
