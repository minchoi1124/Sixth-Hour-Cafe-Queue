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
  doc,
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
  categoryDoc,
  drinkDoc,
  drinksCol,
  memberDoc,
  membersCol,
  orderDoc,
  ownerInvitesCol,
  sessionsCol,
  slugDoc,
  staffPasscodeDoc,
  userDoc,
} from '@/lib/cafe-paths';
import { startSession } from '@/lib/sessions';
import { createPreset } from '@/lib/presets';
import { LATEST_UPDATE_ID } from '@/lib/updates';
import { STAFF_LOCATION_CLAIM, STAFF_PASSCODE_VERSION_CLAIM } from '@/lib/staff-passcode';
import { ADMIN_CLAIM } from '@/lib/admin';

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

  test('staff can see the passcode, but only the owner changes it', async () => {
    await assertSucceeds(getDoc(staffPasscodeDoc(passcodeDb(), LOCATION)));
    await assertFails(getDoc(staffPasscodeDoc(passcodeDb(), 'other-place')));
    await assertFails(getDoc(doc(passcodeDb(), 'locations', LOCATION, 'private', 'staffPasscodeAttempts')));
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

  test('an old staff account promoted to owner has full access', async () => {
    // What scripts/promote-staff-to-owners.ts does.
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore() as unknown as Firestore;
      await updateDoc(memberDoc(admin, LOCATION, OLD_STAFF.uid), { role: 'owner' });
      await updateDoc(userDoc(admin, OLD_STAFF.uid), { role: 'owner' });
    });
    const db = dbFor(OLD_STAFF);
    await assertSucceeds(getDocs(sessionsCol(db, LOCATION)));
    await assertSucceeds(updateDoc(cafeDoc(db, LOCATION), { instagram: 'msu' }));
    await assertSucceeds(changePasscode(db, 'blue door 27'));
    await assertSucceeds(updateDoc(userDoc(db, OLD_STAFF.uid), { lastSeenUpdate: LATEST_UPDATE_ID }));
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

  test('staff edit and delete drinks, categories and orders', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore() as unknown as Firestore;
      await setDoc(drinkDoc(admin, LOCATION, 'mocha'), { name: 'Mocha' });
      await setDoc(categoryDoc(admin, LOCATION, 'hot'), { name: 'Hot' });
      await setDoc(orderDoc(admin, LOCATION, 'o1'), { customerName: 'Sam', status: 'pending' });
    });
    const db = passcodeDb();
    await assertSucceeds(updateDoc(drinkDoc(db, LOCATION, 'mocha'), { name: 'Iced Mocha' }));
    await assertSucceeds(deleteDoc(drinkDoc(db, LOCATION, 'mocha')));
    await assertSucceeds(updateDoc(categoryDoc(db, LOCATION, 'hot'), { name: 'Warm' }));
    await assertSucceeds(deleteDoc(categoryDoc(db, LOCATION, 'hot')));
    await assertSucceeds(updateDoc(orderDoc(db, LOCATION, 'o1'), { status: 'completed' }));
    await assertSucceeds(deleteDoc(orderDoc(db, LOCATION, 'o1')));
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

/** "Add another location", as in src/app/onboarding/page.tsx with ?add=1. */
async function addLocation(db: Firestore, user: { uid: string; email: string }, locationId: string, slug: string) {
  await runTransaction(db, async (tx) => {
    await tx.get(slugDoc(db, slug));
    await tx.get(userDoc(db, user.uid));
    await tx.get(cafeDoc(db, locationId));
    tx.set(cafeDoc(db, locationId), { location: 'Downtown', slug, createdAt: serverTimestamp() });
    tx.set(memberDoc(db, locationId, user.uid), { email: user.email, role: 'owner', joinedAt: serverTimestamp() });
    tx.set(userDoc(db, user.uid), {
      locationId,
      locationIds: [LOCATION, locationId],
      role: 'owner',
      email: user.email,
    });
    tx.set(slugDoc(db, slug), { locationId });
  });
}

describe('several locations', () => {
  beforeEach(seedLocation);

  test('an owner adds another location to the same account', async () => {
    await assertSucceeds(addLocation(dbFor(OWNER), OWNER, 'downtown', 'downtown'));
    const pointer = await getDoc(userDoc(dbFor(OWNER), OWNER.uid));
    assert.deepEqual(pointer.get('locationIds'), [LOCATION, 'downtown']);
    await assertSucceeds(updateDoc(cafeDoc(dbFor(OWNER), LOCATION), { location: 'Still mine' }));
  });

  test('the account switches only between locations it owns', async () => {
    await addLocation(dbFor(OWNER), OWNER, 'downtown', 'downtown');
    const ref = userDoc(dbFor(OWNER), OWNER.uid);
    await assertSucceeds(updateDoc(ref, { locationId: LOCATION }));
    await assertSucceeds(updateDoc(ref, { locationId: 'downtown' }));
    await assertFails(updateDoc(ref, { locationId: 'other-place' }));
  });

  test('listing a location in locationIds grants nothing', async () => {
    const db = dbFor(OUTSIDER);
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore() as unknown as Firestore;
      await setDoc(memberDoc(admin, 'other-place', OUTSIDER.uid), { email: OUTSIDER.email, role: 'owner' });
    });
    await assertSucceeds(
      setDoc(userDoc(db, OUTSIDER.uid), {
        locationId: 'other-place',
        locationIds: ['other-place', LOCATION],
        role: 'owner',
        email: OUTSIDER.email,
      }),
    );
    await assertFails(getDocs(sessionsCol(db, LOCATION)));
    await assertFails(updateDoc(cafeDoc(db, LOCATION), { location: 'Mine now' }));
  });

  test('locationIds must be a short list', async () => {
    const ref = userDoc(dbFor(OWNER), OWNER.uid);
    await assertFails(updateDoc(ref, { locationIds: LOCATION }));
    await assertFails(updateDoc(ref, { locationIds: Array.from({ length: 51 }, (_, i) => `loc-${i}`) }));
  });
});

describe('co-owner invite links', () => {
  beforeEach(async () => {
    await seedLocation();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore() as unknown as Firestore;
      await setDoc(doc(ownerInvitesCol(admin, LOCATION), 'hash-1'), { createdBy: OWNER.uid });
    });
  });

  test('owners see and revoke them', async () => {
    const db = dbFor(OWNER);
    const listed = await getDocs(ownerInvitesCol(db, LOCATION));
    assert.equal(listed.size, 1);
    await assertSucceeds(deleteDoc(doc(ownerInvitesCol(db, LOCATION), 'hash-1')));
  });

  test('only the server makes or uses them', async () => {
    const db = dbFor(OWNER);
    await assertFails(setDoc(doc(ownerInvitesCol(db, LOCATION), 'hash-2'), { createdBy: OWNER.uid }));
    await assertFails(updateDoc(doc(ownerInvitesCol(db, LOCATION), 'hash-1'), { usedBy: OUTSIDER.uid }));
  });

  test('staff and outsiders can’t see them', async () => {
    await assertFails(getDocs(ownerInvitesCol(passcodeDb(), LOCATION)));
    await assertFails(getDocs(ownerInvitesCol(dbFor(OUTSIDER), LOCATION)));
    await assertFails(getDocs(ownerInvitesCol(anonDb(), LOCATION)));
  });

  test('nobody joins or removes owners from the client', async () => {
    await assertFails(
      setDoc(memberDoc(dbFor(OUTSIDER), LOCATION, OUTSIDER.uid), { email: OUTSIDER.email, role: 'owner' }),
    );
    await assertFails(deleteDoc(memberDoc(dbFor(OWNER), LOCATION, OLD_STAFF.uid)));
  });
});

/** An account with the admin claim, as scripts/make-admin.ts gives it. */
const adminDbFor = (user: { uid: string; email: string }) =>
  env.authenticatedContext(user.uid, { email: user.email, [ADMIN_CLAIM]: true }).firestore() as unknown as Firestore;

/** Adding a hidden test location, as /onboarding?add=1&test=1 does it. */
async function addTestLocation(db: Firestore, user: { uid: string; email: string }) {
  await runTransaction(db, async (tx) => {
    await tx.get(slugDoc(db, 'test-k7q2px'));
    await tx.get(userDoc(db, user.uid));
    await tx.get(cafeDoc(db, 'test-kitchen'));
    tx.set(cafeDoc(db, 'test-kitchen'), {
      location: 'Test kitchen',
      slug: 'test-k7q2px',
      createdAt: serverTimestamp(),
      hidden: true,
    });
    tx.set(memberDoc(db, 'test-kitchen', user.uid), { email: user.email, role: 'owner', joinedAt: serverTimestamp() });
    tx.set(userDoc(db, user.uid), {
      locationId: 'test-kitchen',
      locationIds: [LOCATION, 'test-kitchen'],
      role: 'owner',
      email: user.email,
    });
    tx.set(slugDoc(db, 'test-k7q2px'), { locationId: 'test-kitchen' });
  });
}

describe('test locations (admin only)', () => {
  beforeEach(seedLocation);

  test('the admin makes a hidden test location', async () => {
    await assertSucceeds(addTestLocation(adminDbFor(OWNER), OWNER));
    const made = await getDoc(cafeDoc(dbFor(OWNER), 'test-kitchen'));
    assert.equal(made.get('hidden'), true);
  });

  test('an owner without the claim can’t make one', async () => {
    await assertFails(addTestLocation(dbFor(OWNER), OWNER));
  });

  test('only the admin hides or shows a location, and only one they own', async () => {
    await assertFails(updateDoc(cafeDoc(dbFor(OWNER), LOCATION), { hidden: true }));
    await assertSucceeds(updateDoc(cafeDoc(adminDbFor(OWNER), LOCATION), { hidden: true }));
    await assertSucceeds(updateDoc(cafeDoc(adminDbFor(OWNER), LOCATION), { hidden: false }));
    await assertFails(updateDoc(cafeDoc(adminDbFor(OUTSIDER), LOCATION), { hidden: true }));
  });

  test('staff can’t hide or show it', async () => {
    await assertFails(updateDoc(cafeDoc(passcodeDb(), LOCATION), { hidden: true }));
  });

  test('a co-owner without the claim runs a test location but can’t unhide it', async () => {
    await addTestLocation(adminDbFor(OWNER), OWNER);
    await env.withSecurityRulesDisabled(async (ctx) => {
      const admin = ctx.firestore() as unknown as Firestore;
      await setDoc(memberDoc(admin, 'test-kitchen', OUTSIDER.uid), { email: OUTSIDER.email, role: 'owner' });
    });
    const db = dbFor(OUTSIDER);
    await assertSucceeds(updateDoc(cafeDoc(db, 'test-kitchen'), { location: 'Renamed kitchen' }));
    await assertFails(updateDoc(cafeDoc(db, 'test-kitchen'), { hidden: false }));
  });
});
