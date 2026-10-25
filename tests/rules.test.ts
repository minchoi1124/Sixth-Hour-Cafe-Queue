/**
 * Security rules for the `locations/` layout, run against the Firestore
 * emulator. Where the app's own write helpers can run outside React
 * (`startSession`, `createPreset`, `addDocWithReadableId`) they're called
 * directly; the onboarding, join and settings writes live in page components,
 * so those are reproduced here with the same shape.
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
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  addDocWithReadableId,
  cafeDoc,
  cafeInviteDoc,
  drinkDoc,
  drinksCol,
  inviteCodeDoc,
  memberDoc,
  membersCol,
  orderDoc,
  sessionsCol,
  slugDoc,
  userDoc,
} from '@/lib/cafe-paths';
import { startSession } from '@/lib/sessions';
import { createPreset } from '@/lib/presets';
import { LATEST_UPDATE_ID } from '@/lib/updates';

const PROJECT_ID = 'demo-sixth-hour';
const LOCATION = 'msu-campus';
const CODE = 'K7Q2PX9R';

const OWNER = { uid: 'owner-uid', email: 'owner@example.com' };
const STAFF = { uid: 'staff-uid', email: 'staff@example.com' };
const OUTSIDER = { uid: 'outsider-uid', email: 'outsider@example.com' };

let env: RulesTestEnvironment;

/** A signed-in user's Firestore, typed as the modular one the app uses. */
const dbFor = (user: { uid: string; email: string }) =>
  env.authenticatedContext(user.uid, { email: user.email }).firestore() as unknown as Firestore;
const anonDb = () => env.unauthenticatedContext().firestore() as unknown as Firestore;

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

/** The join batch, as in src/app/join/page.tsx. */
function join(db: Firestore, user: { uid: string; email: string }, locationId: string, code: string, role = 'staff') {
  const batch = writeBatch(db);
  batch.set(memberDoc(db, locationId, user.uid), { email: user.email, role, code, joinedAt: serverTimestamp() });
  batch.set(userDoc(db, user.uid), { locationId, role, email: user.email, lastSeenUpdate: LATEST_UPDATE_ID });
  return batch.commit();
}

/** A location with an owner, an invite code and a staff member, written past the rules. */
async function seedLocation() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    await setDoc(cafeDoc(db, LOCATION), { location: 'MSU Campus', slug: 'msu' });
    await setDoc(memberDoc(db, LOCATION, OWNER.uid), { email: OWNER.email, role: 'owner' });
    await setDoc(userDoc(db, OWNER.uid), { locationId: LOCATION, role: 'owner', email: OWNER.email });
    await setDoc(memberDoc(db, LOCATION, STAFF.uid), { email: STAFF.email, role: 'staff', code: CODE });
    await setDoc(userDoc(db, STAFF.uid), { locationId: LOCATION, role: 'staff', email: STAFF.email });
    await setDoc(slugDoc(db, 'msu'), { locationId: LOCATION });
    await setDoc(inviteCodeDoc(db, CODE), { locationId: LOCATION });
    await setDoc(cafeInviteDoc(db, LOCATION), { code: CODE });
    await setDoc(cafeDoc(db, 'other-place'), { location: 'Other', slug: 'other' });
    await setDoc(inviteCodeDoc(db, 'OTHERCODE'), { locationId: 'other-place' });
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

describe('joining as staff', () => {
  const NEW = { uid: 'new-staff', email: 'new@example.com' };

  test('a valid invite code joins the location', async () => {
    await seedLocation();
    await assertSucceeds(join(dbFor(NEW), NEW, LOCATION, CODE));
  });

  test('a made-up code, or one for another location, is rejected', async () => {
    await seedLocation();
    await assertFails(join(dbFor(NEW), NEW, LOCATION, 'NOPE1234'));
    await assertFails(join(dbFor(NEW), NEW, LOCATION, 'OTHERCODE'));
  });

  test('cannot join as owner with a staff code', async () => {
    await seedLocation();
    await assertFails(join(dbFor(NEW), NEW, LOCATION, CODE, 'owner'));
  });

  test('a user pointer alone, without a membership, is rejected', async () => {
    await seedLocation();
    await assertFails(setDoc(userDoc(dbFor(NEW), NEW.uid), { locationId: LOCATION, role: 'staff', email: NEW.email }));
  });

  test('someone removed from one location can join another', async () => {
    await seedLocation();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(memberDoc(ctx.firestore() as unknown as Firestore, LOCATION, STAFF.uid));
    });
    await assertSucceeds(join(dbFor(STAFF), STAFF, 'other-place', 'OTHERCODE'));
  });
});

describe('working a location', () => {
  beforeEach(seedLocation);

  test('staff add drinks and presets with readable ids', async () => {
    const db = dbFor(STAFF);
    const drinkId = await addDocWithReadableId(db, drinksCol(db, LOCATION), 'Matcha Latte', { name: 'Matcha Latte' });
    assert.equal(drinkId, 'matcha-latte');
    const again = await addDocWithReadableId(db, drinksCol(db, LOCATION), 'Matcha Latte', { name: 'Matcha Latte' });
    assert.equal(again, 'matcha-latte-2');
    assert.equal(await createPreset(db, LOCATION, 'Fall Menu', [drinkId]), 'fall-menu');
  });

  test('staff start a session, which gets a date-prefixed id', async () => {
    const db = dbFor(STAFF);
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
    await assertFails(updateDoc(cafeDoc(dbFor(STAFF), LOCATION), { slug: 'hijacked' }));
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
    await assertFails(setDoc(orderDoc(dbFor(STAFF), LOCATION, 'o1'), { customerName: 'x' }));
    await assertFails(setDoc(orderDoc(anonDb(), LOCATION, 'o1'), { customerName: 'x' }));
  });
});

describe('the roster', () => {
  beforeEach(seedLocation);

  test('only owners see the roster; staff see only themselves', async () => {
    const staffQuery = (db: Firestore) => query(membersCol(db, LOCATION), where('role', '==', 'staff'));
    const roster = await assertSucceeds(getDocs(staffQuery(dbFor(OWNER))));
    assert.deepEqual(roster.docs.map((d) => d.id), [STAFF.uid]);
    await assertFails(getDocs(staffQuery(dbFor(STAFF))));
    await assertSucceeds(getDoc(memberDoc(dbFor(STAFF), LOCATION, STAFF.uid)));
    await assertFails(getDoc(memberDoc(dbFor(STAFF), LOCATION, OWNER.uid)));
  });

  test('the invite code is owner-only', async () => {
    await assertFails(getDoc(cafeInviteDoc(dbFor(STAFF), LOCATION)));
    const db = dbFor(OWNER);
    const batch = writeBatch(db);
    batch.delete(inviteCodeDoc(db, CODE));
    batch.set(inviteCodeDoc(db, 'NEWCODE2'), { locationId: LOCATION });
    batch.set(cafeInviteDoc(db, LOCATION), { code: 'NEWCODE2' });
    await assertSucceeds(batch.commit());
  });

  test('removing staff revokes their access', async () => {
    const db = dbFor(OWNER);
    const batch = writeBatch(db);
    batch.delete(memberDoc(db, LOCATION, STAFF.uid));
    batch.delete(userDoc(db, STAFF.uid));
    await assertSucceeds(batch.commit());
    await assertFails(setDoc(drinkDoc(dbFor(STAFF), LOCATION, 'x'), { name: 'x' }));
  });

  test('staff may leave, but an owner cannot remove themselves', async () => {
    await assertFails(deleteDoc(memberDoc(dbFor(OWNER), LOCATION, OWNER.uid)));
    await assertFails(deleteDoc(memberDoc(dbFor(STAFF), LOCATION, OWNER.uid)));
    await assertSucceeds(deleteDoc(memberDoc(dbFor(STAFF), LOCATION, STAFF.uid)));
  });
});

describe("what's new", () => {
  beforeEach(seedLocation);

  test('staff mark updates seen on their own account only', async () => {
    await assertSucceeds(updateDoc(userDoc(dbFor(STAFF), STAFF.uid), { lastSeenUpdate: LATEST_UPDATE_ID }));
    await assertFails(updateDoc(userDoc(dbFor(STAFF), OWNER.uid), { lastSeenUpdate: LATEST_UPDATE_ID }));
  });

  test('lastSeenUpdate must be a short string', async () => {
    const ref = userDoc(dbFor(STAFF), STAFF.uid);
    await assertFails(updateDoc(ref, { lastSeenUpdate: 42 }));
    await assertFails(updateDoc(ref, { lastSeenUpdate: 'x'.repeat(101) }));
  });

  test('someone removed from their location cannot write it', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(memberDoc(ctx.firestore() as unknown as Firestore, LOCATION, STAFF.uid));
    });
    await assertFails(updateDoc(userDoc(dbFor(STAFF), STAFF.uid), { lastSeenUpdate: LATEST_UPDATE_ID }));
  });
});
