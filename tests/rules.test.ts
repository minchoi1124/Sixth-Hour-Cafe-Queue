/**
 * Security rules for the `locations/` layout, run against the Firestore
 * emulator. Where the app's own write helpers can run outside React
 * (`startSession`, `createPreset`, `addDocWithReadableId`) they're called
 * directly; the onboarding and settings writes live in page components, so
 * those are reproduced here with the same shape. Staff devices are signed in
 * with the claims /api/staff-signin puts on their token.
 *
 *   npm run test:emulator
 */
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  type Firestore,
  deleteDoc,
  getDoc,
  getDocs,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  addDocWithReadableId,
  cafeDoc,
  drinkDoc,
  drinksCol,
  memberDoc,
  membersCol,
  orderDoc,
  sessionsCol,
  slugDoc,
  staffPasscodeDoc,
  userDoc,
} from '@/lib/cafe-paths';
import { startSession } from '@/lib/sessions';
import { createPreset } from '@/lib/presets';
import { LATEST_UPDATE_ID } from '@/lib/updates';
import { STAFF_LOCATION_CLAIM, STAFF_PASSCODE_VERSION_CLAIM } from '@/lib/staff-passcode';

const PROJECT_ID = 'demo-sixth-hour';
const LOCATION = 'msu-campus';

const OWNER = { uid: 'owner-uid', email: 'owner@example.com' };
/** An account left over from the old invite system. */
const OLD_STAFF = { uid: 'staff-uid', email: 'staff@example.com' };
const OUTSIDER = { uid: 'outsider-uid', email: 'outsider@example.com' };

let env: RulesTestEnvironment;

/** A signed-in user's Firestore, typed as the modular one the app uses. */
const dbFor = (user: { uid: string; email: string }) =>
  env.authenticatedContext(user.uid, { email: user.email }).firestore() as unknown as Firestore;
const anonDb = () => env.unauthenticatedContext().firestore() as unknown as Firestore;

/** A phone signed in with a location's passcode, as /api/staff-signin does it. */
const passcodeDb = (locationId = LOCATION, passcodeVersion = 0) =>
  env
    .authenticatedContext('staff-device', {
      [STAFF_LOCATION_CLAIM]: locationId,
      [STAFF_PASSCODE_VERSION_CLAIM]: passcodeVersion,
    })
    .firestore() as unknown as Firestore;

/** The owner changing the passcode, as in src/app/staff/settings/page.tsx. */
function changePasscode(db: Firestore, passcode: string) {
  const batch = writeBatch(db);
  batch.set(staffPasscodeDoc(db, LOCATION), { passcode });
  batch.update(cafeDoc(db, LOCATION), { staffPasscodeVersion: increment(1) });
  return batch.commit();
}

/** The onboarding transaction, as in src/app/onboarding/page.tsx. */
async function onboard(db: Firestore, user: { uid: string; email: string }, locationId: string, slug: string) {
  await runTransaction(db, async (tx) => {
    await tx.get(slugDoc(db, slug));
    await tx.get(cafeDoc(db, locationId));
    tx.set(cafeDoc(db, locationId), { location: 'MSU Campus', slug, createdAt: serverTimestamp() });
    tx.set(memberDoc(db, locationId, user.uid), { email: user.email, role: 'owner', joinedAt: serverTimestamp() });
    tx.set(userDoc(db, user.uid), { locationId, role: 'owner', email: user.email, lastSeenUpdate: LATEST_UPDATE_ID });
    tx.set(slugDoc(db, slug), { locationId });
  });
}

/**
 * A location with an owner, plus a staff account left over from the old
 * invite system, written past the rules. No passcode is saved, so it's the default,
 * and no `staffPasscodeVersion`, so it's 0.
 */
async function seedLocation() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(cafeDoc(db, LOCATION), { location: 'MSU Campus', slug: 'msu' });
    await setDoc(memberDoc(db, LOCATION, OWNER.uid), { email: OWNER.email, role: 'owner' });
    await setDoc(userDoc(db, OWNER.uid), { locationId: LOCATION, role: 'owner', email: OWNER.email });
    await setDoc(memberDoc(db, LOCATION, OLD_STAFF.uid), { email: OLD_STAFF.email, role: 'staff', code: 'K7Q2PX9R' });
    await setDoc(userDoc(db, OLD_STAFF.uid), { locationId: LOCATION, role: 'staff', email: OLD_STAFF.email });
    await setDoc(slugDoc(db, 'msu'), { locationId: LOCATION });
    await setDoc(cafeDoc(db, 'other-place'), { location: 'Other', slug: 'other' });
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
beforeEach(() => env.clearFirestore());
after(() => env.cleanup());

describe('onboarding', () => {
  test('a new owner creates location, membership, pointer and slug in one write', async () => {
    await assertSucceeds(onboard(dbFor(OWNER), OWNER, LOCATION, 'msu'));
  });

  test('cannot create a location without the owner membership', async () => {
    const db = dbFor(OWNER);
    await assertFails(setDoc(cafeDoc(db, LOCATION), { location: 'MSU Campus', slug: 'msu' }));
  });

  test('cannot take over an existing location by writing an owner membership', async () => {
    await seedLocation();
    const db = dbFor(OUTSIDER);
    await assertFails(
      setDoc(memberDoc(db, LOCATION, OUTSIDER.uid), { email: OUTSIDER.email, role: 'owner', joinedAt: serverTimestamp() }),
    );
    await assertFails(onboard(db, OUTSIDER, LOCATION, 'new-slug'));
  });

  test('cannot claim a slug for someone else’s location', async () => {
    await seedLocation();
    await assertFails(setDoc(slugDoc(dbFor(OUTSIDER), 'stolen'), { locationId: LOCATION }));
  });

  test('cannot store someone else’s email on the membership', async () => {
    const db = dbFor(OWNER);
    await assertFails(
      runTransaction(db, async (tx) => {
        tx.set(cafeDoc(db, LOCATION), { location: 'MSU Campus', slug: 'msu' });
        tx.set(memberDoc(db, LOCATION, OWNER.uid), { email: 'someone@else.com', role: 'owner', joinedAt: serverTimestamp() });
      }),
    );
  });
});

describe('staff passcode sign-in', () => {
  beforeEach(seedLocation);

  test('a passcode sign-in works only at its own location', async () => {
    await assertSucceeds(getDocs(sessionsCol(passcodeDb(), LOCATION)));
    await assertFails(getDocs(sessionsCol(passcodeDb('other-place'), LOCATION)));
    await assertFails(setDoc(drinkDoc(passcodeDb('other-place'), LOCATION, 'x'), { name: 'x' }));
  });

  test('changing the passcode signs out older sign-ins', async () => {
    await assertSucceeds(changePasscode(dbFor(OWNER), '482913'));
    await assertFails(getDocs(sessionsCol(passcodeDb(LOCATION, 0), LOCATION)));
    await assertFails(setDoc(drinkDoc(passcodeDb(LOCATION, 0), LOCATION, 'x'), { name: 'x' }));
    await assertSucceeds(getDocs(sessionsCol(passcodeDb(LOCATION, 1), LOCATION)));
  });

  test('only the owner sees or changes the passcode', async () => {
    await assertFails(getDoc(staffPasscodeDoc(passcodeDb(), LOCATION)));
    await assertFails(changePasscode(passcodeDb(), '111111'));
    await assertFails(updateDoc(cafeDoc(passcodeDb(), LOCATION), { staffPasscodeVersion: 5 }));
    await assertFails(getDoc(staffPasscodeDoc(dbFor(OUTSIDER), LOCATION)));
    await assertSucceeds(getDoc(staffPasscodeDoc(dbFor(OWNER), LOCATION)));
  });

  test('accounts from the old invite system no longer get in', async () => {
    const db = dbFor(OLD_STAFF);
    await assertFails(getDocs(sessionsCol(db, LOCATION)));
    await assertFails(setDoc(drinkDoc(db, LOCATION, 'x'), { name: 'x' }));
    await assertFails(updateDoc(cafeDoc(db, LOCATION), { activeSessionId: null }));
  });

  test('a staff pointer or membership can no longer be created', async () => {
    const NEW = { uid: 'new-staff', email: 'new@example.com' };
    const db = dbFor(NEW);
    await assertFails(
      setDoc(memberDoc(db, LOCATION, NEW.uid), { email: NEW.email, role: 'staff', joinedAt: serverTimestamp() }),
    );
    await assertFails(setDoc(userDoc(db, NEW.uid), { locationId: LOCATION, role: 'staff', email: NEW.email }));
  });
});

describe('working a location', () => {
  beforeEach(seedLocation);

  test('staff add drinks and presets with readable ids', async () => {
    const db = passcodeDb();
    const drinkId = await addDocWithReadableId(db, drinksCol(db, LOCATION), 'Matcha Latte', { name: 'Matcha Latte' });
    assert.equal(drinkId, 'matcha-latte');
    const again = await addDocWithReadableId(db, drinksCol(db, LOCATION), 'Matcha Latte', { name: 'Matcha Latte' });
    assert.equal(again, 'matcha-latte-2');
    assert.equal(await createPreset(db, LOCATION, 'Fall Menu', [drinkId]), 'fall-menu');
  });

  test('staff start a session, which gets a date-prefixed id', async () => {
    const db = passcodeDb();
    const { sessionId, started } = await startSession(db, LOCATION, {
      location: 'Library 2nd Floor',
      startsAt: new Date(),
      menuIds: ['matcha-latte'],
    });
    assert.ok(started);
    assert.match(sessionId, /^\d{4}-\d{2}-\d{2}_library-2nd-floor_[a-z0-9]{4}$/);
    const location = await getDoc(cafeDoc(db, LOCATION));
    assert.equal(location.get('activeSessionId'), sessionId);
  });

  test('staff cannot change location settings', async () => {
    await assertFails(updateDoc(cafeDoc(passcodeDb(), LOCATION), { slug: 'hijacked' }));
    await assertSucceeds(updateDoc(cafeDoc(dbFor(OWNER), LOCATION), { slug: 'msu-2' }));
  });

  test('outsiders read the public menu but nothing staff-only', async () => {
    for (const db of [dbFor(OUTSIDER), anonDb()]) {
      await assertSucceeds(getDoc(cafeDoc(db, LOCATION)));
      await assertSucceeds(getDocs(drinksCol(db, LOCATION)));
      await assertFails(getDocs(sessionsCol(db, LOCATION)));
      await assertFails(getDocs(membersCol(db, LOCATION)));
      await assertFails(setDoc(drinkDoc(db, LOCATION, 'x'), { name: 'x' }));
    }
  });

  test('nobody creates orders from the client', async () => {
    await assertFails(setDoc(orderDoc(passcodeDb(), LOCATION, 'o1'), { customerName: 'x' }));
    await assertFails(setDoc(orderDoc(anonDb(), LOCATION, 'o1'), { customerName: 'x' }));
  });
});

describe('the owner membership', () => {
  beforeEach(seedLocation);

  test('only owners see the roster; others see only their own', async () => {
    await assertSucceeds(getDocs(membersCol(dbFor(OWNER), LOCATION)));
    await assertFails(getDocs(membersCol(passcodeDb(), LOCATION)));
    await assertSucceeds(getDoc(memberDoc(dbFor(OWNER), LOCATION, OWNER.uid)));
    await assertFails(getDoc(memberDoc(dbFor(OUTSIDER), LOCATION, OWNER.uid)));
  });

  test('an owner cannot remove themselves', async () => {
    await assertFails(deleteDoc(memberDoc(dbFor(OWNER), LOCATION, OWNER.uid)));
    await assertFails(deleteDoc(memberDoc(passcodeDb(), LOCATION, OWNER.uid)));
  });
});

describe("what's new", () => {
  beforeEach(seedLocation);

  test('owners mark updates seen on their own account only', async () => {
    await assertSucceeds(updateDoc(userDoc(dbFor(OWNER), OWNER.uid), { lastSeenUpdate: LATEST_UPDATE_ID }));
    await assertFails(updateDoc(userDoc(dbFor(OUTSIDER), OWNER.uid), { lastSeenUpdate: LATEST_UPDATE_ID }));
  });

  test('lastSeenUpdate must be a short string', async () => {
    const ref = userDoc(dbFor(OWNER), OWNER.uid);
    await assertFails(updateDoc(ref, { lastSeenUpdate: 42 }));
    await assertFails(updateDoc(ref, { lastSeenUpdate: 'x'.repeat(101) }));
  });

  test('an old staff account cannot write its pointer', async () => {
    await assertFails(updateDoc(userDoc(dbFor(OLD_STAFF), OLD_STAFF.uid), { lastSeenUpdate: LATEST_UPDATE_ID }));
  });
});
