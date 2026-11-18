/**
 * Ending sessions left running (src/lib/auto-end-session.ts), against the
 * Firestore emulator with the Admin SDK, as the cron and /api/orders run it.
 *
 *   npm run test:emulator
 */
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { endIdleSessions, endSessionIfIdle } from '@/lib/auto-end-session';
import { SESSION_IDLE_MS } from '@/lib/session-idle';

const PROJECT_ID = 'demo-sixth-hour';
if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

const LOCATION = 'auto-end-cafe';
const SESSION = '2026-11-18_library_ab12';
const HOUR = 60 * 60 * 1000;

const NOW = new Date('2026-11-19T09:00:00Z');
const ago = (ms: number) => Timestamp.fromDate(new Date(NOW.getTime() - ms));

async function clearAll() {
  await db.recursiveDelete(db.collection('locations'));
}

/** A location with a running session that started `startedAgo` before NOW. */
async function seedRunning(startedAgo: number) {
  await db.doc(`locations/${LOCATION}`).set({
    location: 'Auto End Cafe',
    slug: 'auto-end',
    activeSessionId: SESSION,
    liveMenu: { drinkIds: ['latte'] },
  });
  await db.doc(`locations/${LOCATION}/sessions/${SESSION}`).set({
    location: 'Library',
    startsAt: ago(startedAgo),
    endedAt: null,
    status: 'active',
    menuIds: ['latte'],
    soldOutIds: [],
  });
}

async function addOrder(id: string, placedAgo: number, status: 'pending' | 'completed' | 'cancelled', drinks: string[]) {
  await db.doc(`locations/${LOCATION}/orders/${id}`).set({
    customerName: id,
    items: drinks.map((name) => ({ id: name, name, modifications: [] })),
    status,
    sessionId: SESSION,
    createdAt: ago(placedAgo),
  });
}

const session = async () => (await db.doc(`locations/${LOCATION}/sessions/${SESSION}`).get()).data()!;
const location = async () => (await db.doc(`locations/${LOCATION}`).get()).data()!;

describe('ending idle sessions', () => {
  beforeEach(clearAll);

  test('a session with no orders for 3 hours ends at its last order', async () => {
    await seedRunning(6 * HOUR);
    await addOrder('first', 5 * HOUR, 'completed', ['Latte', 'Mocha']);
    await addOrder('last', 4 * HOUR, 'completed', ['Latte']);
    await addOrder('waiting', 4.5 * HOUR, 'pending', ['Chai']);

    assert.equal(await endSessionIfIdle(db, LOCATION, NOW), true);

    const ended = await session();
    assert.equal(ended.status, 'ended');
    assert.equal(ended.autoEnded, true);
    assert.equal(ended.endedAt.toMillis(), NOW.getTime() - 4 * HOUR);
    // Stats count completed orders only, like the End button.
    assert.equal(ended.orderCount, 2);
    assert.equal(ended.drinkCount, 3);
    assert.deepEqual(ended.itemCounts, { Latte: 2, Mocha: 1 });

    // The ordering page closes.
    const after = await location();
    assert.equal(after.activeSessionId, null);
    assert.equal(after.liveMenu, null);

    // Orders still waiting are left as they are.
    const waiting = await db.doc(`locations/${LOCATION}/orders/waiting`).get();
    assert.equal(waiting.get('status'), 'pending');
  });

  test('a recent order keeps the session running', async () => {
    await seedRunning(6 * HOUR);
    await addOrder('recent', 2 * HOUR, 'completed', ['Latte']);
    assert.equal(await endSessionIfIdle(db, LOCATION, NOW), false);
    assert.equal((await session()).status, 'active');
    assert.equal((await location()).activeSessionId, SESSION);
  });

  test('a session with no orders yet is measured from its start', async () => {
    await seedRunning(2 * HOUR);
    assert.equal(await endSessionIfIdle(db, LOCATION, NOW), false);

    await seedRunning(SESSION_IDLE_MS + 60_000);
    assert.equal(await endSessionIfIdle(db, LOCATION, NOW), true);
    const ended = await session();
    assert.equal(ended.endedAt.toMillis(), NOW.getTime() - SESSION_IDLE_MS - 60_000);
    assert.equal(ended.orderCount, 0);
  });

  test('a stale lastOrderAt is double-checked against the orders', async () => {
    await seedRunning(6 * HOUR);
    await db.doc(`locations/${LOCATION}/sessions/${SESSION}`).update({ lastOrderAt: ago(5 * HOUR) });
    await addOrder('recent', HOUR, 'pending', ['Latte']);
    assert.equal(await endSessionIfIdle(db, LOCATION, NOW), false);
  });

  test('a recent lastOrderAt skips the order lookup', async () => {
    await seedRunning(6 * HOUR);
    await db.doc(`locations/${LOCATION}/sessions/${SESSION}`).update({ lastOrderAt: ago(HOUR) });
    assert.equal(await endSessionIfIdle(db, LOCATION, NOW), false);
  });

  test('scheduled sessions and locations with nothing running are left alone', async () => {
    await seedRunning(6 * HOUR);
    await db.doc(`locations/${LOCATION}/sessions/${SESSION}`).update({ status: 'scheduled' });
    assert.equal(await endSessionIfIdle(db, LOCATION, NOW), false);

    await db.doc(`locations/${LOCATION}`).update({ activeSessionId: null });
    assert.equal(await endSessionIfIdle(db, LOCATION, NOW), false);
  });

  test('the nightly sweep ends idle sessions across locations', async () => {
    await seedRunning(6 * HOUR);
    await db.doc('locations/busy-cafe').set({ location: 'Busy', slug: 'busy', activeSessionId: 's1' });
    await db.doc('locations/busy-cafe/sessions/s1').set({
      location: 'Hall', startsAt: ago(HOUR), status: 'active', menuIds: [], soldOutIds: [],
    });
    await db.doc('locations/closed-cafe').set({ location: 'Closed', slug: 'closed', activeSessionId: null });

    assert.deepEqual(await endIdleSessions(db, NOW), [LOCATION]);
    assert.equal((await db.doc('locations/busy-cafe').get()).get('activeSessionId'), 's1');
  });
});
