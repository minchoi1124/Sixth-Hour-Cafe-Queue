/**
 * Test locations: clearing one (src/lib/test-locations.ts) against the
 * Firestore emulator with the Admin SDK, as /api/admin/clear-test-location
 * runs it, and leaving them out of the picker (src/lib/location-picker.ts).
 *
 *   npm run test:emulator
 */
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { TestLocationError, clearTestLocation } from '@/lib/test-locations';
import { pickerLocations } from '@/lib/location-picker';

const PROJECT_ID = 'demo-sixth-hour';
if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

const TEST = 'test-kitchen';
const REAL = 'real-cafe';
const ADMIN = 'admin-uid';

const rejectsWith = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (e: unknown) => e instanceof TestLocationError && e.code === code);

/** A location with a running session, two orders, a counter and a menu, owned by ADMIN. */
async function seedLocation(id: string, hidden: boolean) {
  const location = db.doc(`locations/${id}`);
  await location.set({
    location: id,
    slug: id,
    ...(hidden ? { hidden: true } : {}),
    activeSessionId: 'today',
    liveMenu: { drinkIds: ['latte'], soldOutIds: [] },
  });
  await location.collection('members').doc(ADMIN).set({ email: 'admin@example.com', role: 'owner' });
  await location.collection('drinks').doc('latte').set({ name: 'Latte' });
  await location.collection('presets').doc('usual').set({ name: 'Usual', drinkIds: ['latte'] });
  await location.collection('sessions').doc('today').set({ status: 'active' });
  await location.collection('sessions').doc('next-week').set({ status: 'scheduled' });
  await location.collection('orders').doc('a').set({ customerName: 'Sam', status: 'pending' });
  await location.collection('orders').doc('b').set({ customerName: 'Alex', status: 'completed' });
  await location.collection('private').doc('orderCounter').set({ date: '2026-11-19', last: 2 });
  await location.collection('private').doc('staffPasscode').set({ passcode: 'secret1' });
}

const count = async (path: string) => (await db.collection(path).count().get()).data().count;

describe('clearing a test location', () => {
  beforeEach(async () => {
    await db.recursiveDelete(db.collection('locations'));
    await seedLocation(TEST, true);
    await seedLocation(REAL, false);
  });

  test('deletes its orders and sessions, closes it and restarts numbering', async () => {
    assert.deepEqual(await clearTestLocation(db, TEST, ADMIN), { orders: 2, sessions: 2 });
    assert.equal(await count(`locations/${TEST}/orders`), 0);
    assert.equal(await count(`locations/${TEST}/sessions`), 0);
    const location = await db.doc(`locations/${TEST}`).get();
    assert.equal(location.get('activeSessionId'), null);
    assert.equal(location.get('liveMenu'), null);
    assert.equal(location.get('hidden'), true);
    assert.equal((await db.doc(`locations/${TEST}/private/orderCounter`).get()).exists, false);
  });

  test('keeps the menu, presets, passcode and owners', async () => {
    await clearTestLocation(db, TEST, ADMIN);
    assert.equal(await count(`locations/${TEST}/drinks`), 1);
    assert.equal(await count(`locations/${TEST}/presets`), 1);
    assert.equal(await count(`locations/${TEST}/members`), 1);
    assert.equal((await db.doc(`locations/${TEST}/private/staffPasscode`).get()).exists, true);
  });

  test('refuses a location that isn’t hidden, and leaves it alone', async () => {
    await rejectsWith(clearTestLocation(db, REAL, ADMIN), 'not-hidden');
    assert.equal(await count(`locations/${REAL}/orders`), 2);
    assert.equal(await count(`locations/${REAL}/sessions`), 2);
  });

  test('refuses someone who doesn’t own it', async () => {
    await rejectsWith(clearTestLocation(db, TEST, 'someone-else'), 'not-owner');
    assert.equal(await count(`locations/${TEST}/orders`), 2);
  });

  test('refuses a location that doesn’t exist', async () => {
    await rejectsWith(clearTestLocation(db, 'nowhere', ADMIN), 'not-found');
  });

  test('touches no other location', async () => {
    await clearTestLocation(db, TEST, ADMIN);
    assert.equal(await count(`locations/${REAL}/orders`), 2);
    assert.equal((await db.doc(`locations/${REAL}`).get()).get('activeSessionId'), 'today');
  });
});

describe('the location picker', () => {
  const all = [
    { id: 'msu-campus', name: 'MSU Campus', slug: 'msu', hidden: false },
    { id: 'test-kitchen', name: 'Test kitchen', slug: 'test-k7q2px', hidden: true },
    { id: 'downtown', name: 'Downtown', slug: 'downtown', hidden: false },
  ];

  test('leaves hidden locations out, sorted by name', () => {
    assert.deepEqual(
      pickerLocations(all).map((location) => location.id),
      ['downtown', 'msu-campus'],
    );
  });

  test('shows a hidden one opened with its own link', () => {
    assert.deepEqual(
      pickerLocations(all, 'test-k7q2px').map((location) => location.id),
      ['downtown', 'msu-campus', 'test-kitchen'],
    );
  });

  test('another slug reveals nothing', () => {
    assert.deepEqual(
      pickerLocations(all, 'msu').map((location) => location.id),
      ['downtown', 'msu-campus'],
    );
  });

  test('doesn’t pass `hidden` on to the page', () => {
    assert.ok(pickerLocations(all, 'test-k7q2px').every((location) => !('hidden' in location)));
  });
});
