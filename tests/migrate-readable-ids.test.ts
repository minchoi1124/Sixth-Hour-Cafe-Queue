/**
 * End-to-end run of scripts/migrate-readable-ids.ts against the emulators:
 * seed the old `cafes/{uid}` layout, run the script the way it's run for real
 * (dry run → copy → catch-up → cleanup), and check the result, including that
 * the migrated data works under the new security rules.
 *
 *   npm run test:emulator
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { type Firestore, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { drinkDoc, memberDoc, membersCol } from '@/lib/cafe-paths';
import { startSession } from '@/lib/sessions';

const PROJECT_ID = 'demo-sixth-hour';
const OWNER_A = 'ownerAuidXXXXXXXXXXXX';
const OWNER_C = 'ownerCuidXXXXXXXXXXXX';
const STAFF_B = 'staffBuidXXXXXXXXXXXX';

if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();
let env: RulesTestEnvironment;

/** 2026-10-24 14:32:05 in New York. */
const ORDER_TIME = Timestamp.fromDate(new Date('2026-10-24T18:32:05Z'));

function migrate(...flags: string[]) {
  return execFileSync('npx', ['tsx', 'scripts/migrate-readable-ids.ts', ...flags], {
    encoding: 'utf8',
    env: process.env,
  });
}

const ids = async (path: string) => (await db.collection(path).get()).docs.map((d) => d.id).sort();

async function seedOldLayout() {
  const auth = getAuth();
  await auth.createUser({ uid: OWNER_A, email: 'owner-a@example.com' });
  await auth.createUser({ uid: OWNER_C, email: 'owner-c@example.com' });

  const a = db.doc(`cafes/${OWNER_A}`);
  await a.set({
    location: 'MSU Campus',
    slug: 'msu',
    timezone: 'America/New_York',
    createdAt: Timestamp.fromDate(new Date('2025-01-01')),
    activeSessionId: 'SessOne111',
    liveMenu: { drinkIds: ['DrinkAaaa', 'DrinkBbbb'], soldOutIds: ['DrinkBbbb'] },
  });
  // Two drinks with the same name: the older id gets the bare readable id.
  await a.collection('drinks').doc('DrinkAaaa').set({ name: 'Matcha Latte', category: 'Tea' });
  await a.collection('drinks').doc('DrinkBbbb').set({ name: 'Matcha Latte', category: 'Tea' });
  await a.collection('drinks').doc('DrinkCccc').set({ name: 'London Fog', category: 'Tea' });
  await a.collection('categories').doc('CatTea111').set({ name: 'Tea' });
  await a.collection('presets').doc('PresetFal').set({ name: 'Fall Menu', drinkIds: ['DrinkCccc', 'DrinkAaaa'] });
  await a.collection('recipes').doc('DrinkAaaa').set({ ingredients: ['matcha'], instructions: 'whisk' });
  await a.collection('sessions').doc('SessOne111').set({
    location: 'Library 2nd Floor',
    startsAt: ORDER_TIME,
    status: 'active',
    menuIds: ['DrinkAaaa', 'DrinkBbbb', 'DeletedDrk'],
    soldOutIds: ['DrinkBbbb'],
    presetId: 'PresetFal',
  });
  await a.collection('orders').doc('OrderOne11').set({
    customerName: 'Min Hyuk',
    items: [{ id: 'DrinkAaaa', name: 'Matcha Latte', modifications: [] }],
    status: 'completed',
    sessionId: 'SessOne111',
    createdAt: ORDER_TIME,
  });
  await a.collection('orders').doc('OrderTwo22').set({
    customerName: '민혁',
    items: [{ id: 'DrinkCccc', name: 'London Fog', modifications: [] }],
    status: 'pending',
    sessionId: null,
    createdAt: ORDER_TIME,
  });
  await a.collection('private').doc('invite').set({ code: 'K7Q2PX9R' });

  // A second location with the same name.
  await db.doc(`cafes/${OWNER_C}`).set({
    location: 'MSU Campus',
    slug: 'msu-east',
    createdAt: Timestamp.fromDate(new Date('2026-01-01')),
  });

  await db.doc(`userCafes/${STAFF_B}`).set({ cafeId: OWNER_A, role: 'staff', email: 'staff-b@example.com', code: 'K7Q2PX9R' });
  await db.doc('slugs/msu').set({ cafeId: OWNER_A });
  await db.doc('slugs/msu-east').set({ cafeId: OWNER_C });
  await db.doc('inviteCodes/K7Q2PX9R').set({ cafeId: OWNER_A });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
  await env.clearFirestore();
  await seedOldLayout();
});
after(() => env.cleanup());

const LOC = 'locations/msu-campus';

describe('migrate-readable-ids', () => {
  test('a dry run writes nothing', async () => {
    const out = migrate();
    assert.match(out, /DRY RUN/);
    assert.match(out, /cafes\/ownerAuid\S* → locations\/msu-campus/);
    assert.deepEqual(await ids('locations'), []);
  });

  test('--commit copies each cafe to a readable location id', async () => {
    migrate('--commit');
    assert.deepEqual(await ids('locations'), ['msu-campus', 'msu-campus-2']);
    assert.deepEqual(await ids(`${LOC}/drinks`), ['london-fog', 'matcha-latte', 'matcha-latte-2']);
    assert.deepEqual(await ids(`${LOC}/categories`), ['tea']);
    assert.deepEqual(await ids(`${LOC}/presets`), ['fall-menu']);
    assert.deepEqual(await ids(`${LOC}/recipes`), ['matcha-latte']);
    assert.deepEqual(await ids(`${LOC}/sessions`), ['2026-10-24_library-2nd-floor_sess']);
    assert.deepEqual(await ids(`${LOC}/orders`), [
      '2026-10-24_14-32-05_guest_orde',
      '2026-10-24_14-32-05_min-hyuk_orde',
    ]);
  });

  test('every reference points at the new ids', async () => {
    const location = (await db.doc(LOC).get()).data()!;
    assert.equal(location.activeSessionId, '2026-10-24_library-2nd-floor_sess');
    assert.deepEqual(location.liveMenu, { drinkIds: ['matcha-latte', 'matcha-latte-2'], soldOutIds: ['matcha-latte-2'] });

    const session = (await db.doc(`${LOC}/sessions/2026-10-24_library-2nd-floor_sess`).get()).data()!;
    // A deleted drink keeps its old id rather than vanishing from history.
    assert.deepEqual(session.menuIds, ['matcha-latte', 'matcha-latte-2', 'DeletedDrk']);
    assert.deepEqual(session.soldOutIds, ['matcha-latte-2']);
    assert.equal(session.presetId, 'fall-menu');

    const preset = (await db.doc(`${LOC}/presets/fall-menu`).get()).data()!;
    assert.deepEqual(preset.drinkIds, ['london-fog', 'matcha-latte']);

    const order = (await db.doc(`${LOC}/orders/2026-10-24_14-32-05_min-hyuk_orde`).get()).data()!;
    assert.equal(order.sessionId, '2026-10-24_library-2nd-floor_sess');
    assert.equal(order.items[0].id, 'matcha-latte');
    const orphan = (await db.doc(`${LOC}/orders/2026-10-24_14-32-05_guest_orde`).get()).data()!;
    assert.equal(orphan.sessionId, null);
    assert.equal(orphan.customerName, '민혁');
  });

  test('people and lookups are rebuilt', async () => {
    assert.deepEqual((await db.doc(`${LOC}/members/${OWNER_A}`).get()).data()?.role, 'owner');
    assert.equal((await db.doc(`${LOC}/members/${OWNER_A}`).get()).get('email'), 'owner-a@example.com');
    assert.equal((await db.doc(`${LOC}/members/${STAFF_B}`).get()).get('role'), 'staff');
    assert.deepEqual((await db.doc(`users/${STAFF_B}`).get()).data(), {
      locationId: 'msu-campus',
      role: 'staff',
      email: 'staff-b@example.com',
    });
    assert.equal((await db.doc(`users/${OWNER_C}`).get()).get('locationId'), 'msu-campus-2');
    // cafeId stays until cleanup so the old app keeps resolving links.
    assert.deepEqual((await db.doc('slugs/msu').get()).data(), { cafeId: OWNER_A, locationId: 'msu-campus' });
    assert.deepEqual((await db.doc('inviteCodes/K7Q2PX9R').get()).data(), { cafeId: OWNER_A, locationId: 'msu-campus' });
    assert.ok((await db.doc(`${LOC}/private/invite`).get()).exists);
  });

  test('a catch-up run adds stragglers without reverting the new app', async () => {
    // The new app has been used since the copy...
    await db.doc(LOC).update({ liveMenu: null, activeSessionId: null });
    await db.doc(`${LOC}/drinks/matcha-latte`).update({ name: 'Iced Matcha' });
    // ...and the old app took one more order before cutover.
    await db.doc(`cafes/${OWNER_A}/orders/OrderLate3`).set({
      customerName: 'Late',
      items: [{ id: 'DrinkCccc', name: 'London Fog', modifications: [] }],
      status: 'pending',
      sessionId: 'SessOne111',
      createdAt: Timestamp.fromDate(new Date('2026-10-24T19:00:00Z')),
    });

    const out = migrate('--commit');
    assert.match(out, /catch-up/);

    const orders = await ids(`${LOC}/orders`);
    assert.equal(orders.length, 3);
    assert.ok(orders.includes('2026-10-24_15-00-00_late_orde'));
    const late = (await db.doc(`${LOC}/orders/2026-10-24_15-00-00_late_orde`).get()).data()!;
    assert.equal(late.sessionId, '2026-10-24_library-2nd-floor_sess');
    assert.equal(late.items[0].id, 'london-fog');

    const location = (await db.doc(LOC).get()).data()!;
    assert.equal(location.liveMenu, null);
    assert.equal((await db.doc(`${LOC}/drinks/matcha-latte`).get()).get('name'), 'Iced Matcha');
  });

  test('migrated data works under the new rules', async () => {
    const staff = env.authenticatedContext(STAFF_B, { email: 'staff-b@example.com' }).firestore() as unknown as Firestore;
    const owner = env.authenticatedContext(OWNER_A, { email: 'owner-a@example.com' }).firestore() as unknown as Firestore;
    const ownerC = env.authenticatedContext(OWNER_C, { email: 'owner-c@example.com' }).firestore() as unknown as Firestore;

    await assertSucceeds(getDoc(memberDoc(staff, 'msu-campus', STAFF_B)));
    await assertSucceeds(setDoc(drinkDoc(staff, 'msu-campus', 'hojicha'), { name: 'Hojicha' }));
    await assertSucceeds(
      startSession(staff, 'msu-campus', { location: 'Union', startsAt: new Date(), menuIds: ['hojicha'] }),
    );
    await assertSucceeds(getDocs(membersCol(owner, 'msu-campus')));
    // Same name, different location: no access across.
    await assertFails(setDoc(drinkDoc(ownerC, 'msu-campus', 'x'), { name: 'x' }));
  });

  test('--cleanup removes the old layout', async () => {
    migrate('--commit', '--cleanup');
    assert.deepEqual(await ids('cafes'), []);
    assert.deepEqual(await ids('userCafes'), []);
    assert.deepEqual((await db.doc('slugs/msu').get()).data(), { locationId: 'msu-campus' });
    assert.deepEqual((await db.doc('inviteCodes/K7Q2PX9R').get()).data(), { locationId: 'msu-campus' });
    assert.ok((await db.doc(`${LOC}/orders/2026-10-24_14-32-05_min-hyuk_orde`).get()).exists);
  });
});
