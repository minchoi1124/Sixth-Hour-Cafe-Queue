/**
 * Co-owner invites and removing owners (src/lib/owners.ts), against the
 * Firestore emulator with the Admin SDK, as the /api/owners/* routes run it.
 *
 *   npm run test:emulator
 */
import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  INVITE_TTL_MS,
  MAX_OPEN_INVITES,
  OwnerError,
  acceptOwnerInvite,
  createOwnerInvite,
  describeOwnerInvite,
  hashInviteToken,
  removeOwner,
} from '@/lib/owners';
import { LATEST_UPDATE_ID } from '@/lib/updates';

const PROJECT_ID = 'demo-sixth-hour';
if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
const db = getFirestore();

const LOCATION = 'owners-cafe';
const OTHER = 'owners-other';
const FOUNDER = { uid: 'founder', email: 'founder@example.com' };
const FRIEND = { uid: 'friend', email: 'friend@example.com' };
const STRANGER = { uid: 'stranger', email: 'stranger@example.com' };

const rejectsWith = (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (e: unknown) => e instanceof OwnerError && e.code === code);

async function clearAll() {
  await Promise.all([
    db.recursiveDelete(db.collection('locations')),
    db.recursiveDelete(db.collection('users')),
  ]);
}

/** LOCATION owned by FOUNDER, whose pointer predates v1.4 (no locationIds). */
async function seed() {
  await clearAll();
  await db.doc(`locations/${LOCATION}`).set({ location: 'Owners Cafe', slug: 'owners' });
  await db.doc(`locations/${LOCATION}/members/${FOUNDER.uid}`).set({ email: FOUNDER.email, role: 'owner' });
  await db.doc(`users/${FOUNDER.uid}`).set({
    locationId: LOCATION,
    role: 'owner',
    email: FOUNDER.email,
    lastSeenUpdate: 'some-old-update',
  });
}

const role = async (locationId: string, uid: string) =>
  (await db.doc(`locations/${locationId}/members/${uid}`).get()).get('role');
const pointer = async (uid: string) => (await db.doc(`users/${uid}`).get()).data();

describe('invite links', () => {
  beforeEach(seed);

  test('an owner makes a link; only its hash is stored', async () => {
    const now = new Date('2026-11-19T12:00:00Z');
    const { token, expiresAt } = await createOwnerInvite(db, LOCATION, FOUNDER, now);
    assert.equal(expiresAt.getTime(), now.getTime() + INVITE_TTL_MS);
    const stored = await db.collection(`locations/${LOCATION}/ownerInvites`).get();
    assert.deepEqual(stored.docs.map((invite) => invite.id), [hashInviteToken(token)]);
    assert.ok(!JSON.stringify(stored.docs[0].data()).includes(token));
    assert.equal(stored.docs[0].get('createdBy'), FOUNDER.uid);
  });

  test('only an owner can make one', async () => {
    await rejectsWith(createOwnerInvite(db, LOCATION, STRANGER), 'not-owner');
  });

  test('a new account accepts it and becomes an owner, opening to that location', async () => {
    const { token } = await createOwnerInvite(db, LOCATION, FOUNDER);
    assert.equal((await describeOwnerInvite(db, LOCATION, token)).locationName, 'Owners Cafe');

    const result = await acceptOwnerInvite(db, LOCATION, token, FRIEND);
    assert.deepEqual(result, { locationName: 'Owners Cafe', alreadyOwner: false });
    assert.equal(await role(LOCATION, FRIEND.uid), 'owner');
    assert.deepEqual(await pointer(FRIEND.uid), {
      locationId: LOCATION,
      locationIds: [LOCATION],
      role: 'owner',
      email: FRIEND.email,
      lastSeenUpdate: LATEST_UPDATE_ID,
    });
    const invite = await db.doc(`locations/${LOCATION}/ownerInvites/${hashInviteToken(token)}`).get();
    assert.equal(invite.get('usedBy'), FRIEND.uid);
  });

  test('an owner of another location keeps it in their list', async () => {
    await db.doc(`locations/${OTHER}`).set({ location: 'Other', slug: 'other' });
    await db.doc(`locations/${OTHER}/members/${FRIEND.uid}`).set({ email: FRIEND.email, role: 'owner' });
    await db.doc(`users/${FRIEND.uid}`).set({ locationId: OTHER, role: 'owner', email: FRIEND.email });

    const { token } = await createOwnerInvite(db, LOCATION, FOUNDER);
    await acceptOwnerInvite(db, LOCATION, token, FRIEND);
    const after = await pointer(FRIEND.uid);
    assert.equal(after?.locationId, LOCATION);
    assert.deepEqual(after?.locationIds, [OTHER, LOCATION]);
    assert.equal(after?.lastSeenUpdate, undefined, 'an existing account keeps what it had seen');
    assert.equal(await role(OTHER, FRIEND.uid), 'owner');
  });

  test('it works once; the same person opening it again is fine', async () => {
    const { token } = await createOwnerInvite(db, LOCATION, FOUNDER);
    await acceptOwnerInvite(db, LOCATION, token, FRIEND);
    await acceptOwnerInvite(db, LOCATION, token, FRIEND);
    await rejectsWith(acceptOwnerInvite(db, LOCATION, token, STRANGER), 'used');
    await rejectsWith(describeOwnerInvite(db, LOCATION, token), 'used');
    assert.equal(await role(LOCATION, STRANGER.uid), undefined);
  });

  test('it expires after 7 days', async () => {
    const made = new Date('2026-11-19T12:00:00Z');
    const { token } = await createOwnerInvite(db, LOCATION, FOUNDER, made);
    const later = new Date(made.getTime() + INVITE_TTL_MS + 1);
    await rejectsWith(acceptOwnerInvite(db, LOCATION, token, FRIEND, later), 'expired');
    await rejectsWith(describeOwnerInvite(db, LOCATION, token, later), 'expired');
    assert.equal(await role(LOCATION, FRIEND.uid), undefined);
  });

  test('a made-up or revoked link, or the wrong location, gets nothing', async () => {
    const { token } = await createOwnerInvite(db, LOCATION, FOUNDER);
    await rejectsWith(acceptOwnerInvite(db, LOCATION, 'x'.repeat(32), FRIEND), 'invalid');
    await rejectsWith(acceptOwnerInvite(db, OTHER, token, FRIEND), 'invalid');
    await db.doc(`locations/${LOCATION}/ownerInvites/${hashInviteToken(token)}`).delete();
    await rejectsWith(acceptOwnerInvite(db, LOCATION, token, FRIEND), 'invalid');
  });

  test('an owner opening a link to their own location leaves it for someone else', async () => {
    const { token } = await createOwnerInvite(db, LOCATION, FOUNDER);
    const result = await acceptOwnerInvite(db, LOCATION, token, FOUNDER);
    assert.equal(result.alreadyOwner, true);
    assert.deepEqual((await pointer(FOUNDER.uid))?.locationIds, [LOCATION]);
    await acceptOwnerInvite(db, LOCATION, token, FRIEND);
    assert.equal(await role(LOCATION, FRIEND.uid), 'owner');
  });

  test(`at most ${MAX_OPEN_INVITES} unused links at once; expired ones are cleared`, async () => {
    const made = new Date('2026-11-01T12:00:00Z');
    for (let i = 0; i < MAX_OPEN_INVITES; i++) await createOwnerInvite(db, LOCATION, FOUNDER, made);
    await rejectsWith(createOwnerInvite(db, LOCATION, FOUNDER, made), 'too-many');

    const weekLater = new Date(made.getTime() + INVITE_TTL_MS + 1);
    await createOwnerInvite(db, LOCATION, FOUNDER, weekLater);
    assert.equal((await db.collection(`locations/${LOCATION}/ownerInvites`).get()).size, 1);
  });
});

describe('removing owners', () => {
  beforeEach(async () => {
    await seed();
    const { token } = await createOwnerInvite(db, LOCATION, FOUNDER);
    await acceptOwnerInvite(db, LOCATION, token, FRIEND);
  });

  test('the last owner cannot leave', async () => {
    await removeOwner(db, LOCATION, FOUNDER.uid, FRIEND.uid);
    await rejectsWith(removeOwner(db, LOCATION, FOUNDER.uid, FOUNDER.uid), 'last-owner');
    assert.equal(await role(LOCATION, FOUNDER.uid), 'owner');
  });

  test('any owner can remove another, even the founder', async () => {
    await removeOwner(db, LOCATION, FRIEND.uid, FOUNDER.uid);
    assert.equal(await role(LOCATION, FOUNDER.uid), undefined);
    // Their only location: the pointer goes, and they're asked to set one up.
    assert.equal(await pointer(FOUNDER.uid), undefined);
  });

  test('leaving moves your account to another location you own', async () => {
    await db.doc(`locations/${OTHER}`).set({ location: 'Other', slug: 'other' });
    await db.doc(`locations/${OTHER}/members/${FRIEND.uid}`).set({ email: FRIEND.email, role: 'owner' });
    await db.doc(`users/${FRIEND.uid}`).update({ locationIds: [OTHER, LOCATION] });

    await removeOwner(db, LOCATION, FRIEND.uid, FRIEND.uid);
    assert.equal(await role(LOCATION, FRIEND.uid), undefined);
    const after = await pointer(FRIEND.uid);
    assert.equal(after?.locationId, OTHER);
    assert.deepEqual(after?.locationIds, [OTHER]);
  });

  test('being removed from a location you are not on only shortens your list', async () => {
    await db.doc(`users/${FRIEND.uid}`).update({ locationId: OTHER, locationIds: [LOCATION, OTHER] });
    await removeOwner(db, LOCATION, FOUNDER.uid, FRIEND.uid);
    const after = await pointer(FRIEND.uid);
    assert.equal(after?.locationId, OTHER);
    assert.deepEqual(after?.locationIds, [OTHER]);
  });

  test('only owners remove people', async () => {
    await rejectsWith(removeOwner(db, LOCATION, STRANGER.uid, FRIEND.uid), 'not-owner');
    await rejectsWith(removeOwner(db, LOCATION, FOUNDER.uid, STRANGER.uid), 'not-found');
    assert.equal(await role(LOCATION, FRIEND.uid), 'owner');
  });
});
