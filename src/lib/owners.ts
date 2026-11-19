import { createHash, randomBytes } from 'node:crypto';
import { FieldValue, Timestamp, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';
import { LATEST_UPDATE_ID } from '@/lib/updates';

/**
 * Co-owners, run on the server with the Admin SDK (the /api/owners/* routes).
 *
 * An owner makes an invite link; whoever opens it signed in to an account
 * becomes an owner of that location too. Links work once and expire after
 * INVITE_TTL_MS. Only a hash of the link's secret is stored, at
 * `locations/{locationId}/ownerInvites/{hash}`, so the links can't be read back
 * out of the database. Owners can see and revoke the pending ones through the
 * rules; making and accepting them happens here.
 *
 * Removing an owner also happens here, because "never remove the last owner"
 * needs a count the rules can't do.
 */

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Unused, unexpired links a location may have at once. */
export const MAX_OPEN_INVITES = 10;

export type OwnerErrorCode =
  | 'not-owner'
  | 'invalid'
  | 'used'
  | 'expired'
  | 'too-many'
  | 'last-owner'
  | 'not-found';

export class OwnerError extends Error {
  constructor(readonly code: OwnerErrorCode) {
    super(code);
  }
}

export const hashInviteToken = (token: string) => createHash('sha256').update(token).digest('hex');

const INVITE_TOKEN_REGEX = /^[A-Za-z0-9_-]{20,100}$/;
export const isInviteToken = (token: unknown): token is string =>
  typeof token === 'string' && INVITE_TOKEN_REGEX.test(token);

const inviteRef = (db: Firestore, locationId: string, token: string) =>
  db.doc(`locations/${locationId}/ownerInvites/${hashInviteToken(token)}`);

async function assertOwner(db: Firestore, locationId: string, uid: string) {
  const member = await db.doc(`locations/${locationId}/members/${uid}`).get();
  if (member.get('role') !== 'owner') throw new OwnerError('not-owner');
}

/** Makes a single-use invite link secret for `locationId`. */
export async function createOwnerInvite(
  db: Firestore,
  locationId: string,
  creator: { uid: string; email: string | null },
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  await assertOwner(db, locationId, creator.uid);

  const invites = await db.collection(`locations/${locationId}/ownerInvites`).get();
  const open = invites.docs.filter(
    (invite) => !invite.get('usedBy') && invite.get('expiresAt').toMillis() > now.getTime(),
  );
  if (open.length >= MAX_OPEN_INVITES) throw new OwnerError('too-many');

  // Tidy up as we go: expired links are no use to anyone.
  const batch = db.batch();
  invites.docs
    .filter((invite) => invite.get('expiresAt').toMillis() <= now.getTime())
    .forEach((invite) => batch.delete(invite.ref));

  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
  batch.create(inviteRef(db, locationId, token), {
    createdBy: creator.uid,
    createdByEmail: creator.email,
    createdAt: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromDate(expiresAt),
  });
  await batch.commit();
  return { token, expiresAt };
}

/** What the invite page shows before it's accepted. Doesn't use the link up. */
export async function describeOwnerInvite(
  db: Firestore,
  locationId: string,
  token: string,
  now = new Date(),
): Promise<{ locationName: string; expiresAt: Date }> {
  const [invite, location] = await Promise.all([
    inviteRef(db, locationId, token).get(),
    db.doc(`locations/${locationId}`).get(),
  ]);
  if (!invite.exists || !location.exists) throw new OwnerError('invalid');
  if (invite.get('usedBy')) throw new OwnerError('used');
  const expiresAt = (invite.get('expiresAt') as Timestamp).toDate();
  if (expiresAt <= now) throw new OwnerError('expired');
  return { locationName: location.get('location') ?? locationId, expiresAt };
}

/** The locations an account's pointer lists, oldest first. */
function listedLocations(pointer: DocumentSnapshot): string[] {
  if (!pointer.exists) return [];
  const list = pointer.get('locationIds');
  if (Array.isArray(list)) return list.filter((id): id is string => typeof id === 'string');
  // Accounts from before v1.4 have only `locationId`. A 'staff' pointer is
  // left over from the old invites and gives nothing.
  const single = pointer.get('locationId');
  return typeof single === 'string' && pointer.get('role') === 'owner' ? [single] : [];
}

/**
 * Uses up the link and makes `user` an owner of its location, which becomes
 * the location their account opens to. Opening a link you've already used is
 * fine; so is opening one for a location you already own (the link is then
 * left for someone else).
 */
export async function acceptOwnerInvite(
  db: Firestore,
  locationId: string,
  token: string,
  user: { uid: string; email: string },
  now = new Date(),
): Promise<{ locationName: string; alreadyOwner: boolean }> {
  const ref = inviteRef(db, locationId, token);
  const locationRef = db.doc(`locations/${locationId}`);
  const memberRef = db.doc(`locations/${locationId}/members/${user.uid}`);
  const pointerRef = db.doc(`users/${user.uid}`);

  return db.runTransaction(async (tx) => {
    const [invite, location, member, pointer] = await Promise.all([
      tx.get(ref),
      tx.get(locationRef),
      tx.get(memberRef),
      tx.get(pointerRef),
    ]);
    if (!invite.exists || !location.exists) throw new OwnerError('invalid');
    const usedBy = invite.get('usedBy') as string | undefined;
    if (usedBy && usedBy !== user.uid) throw new OwnerError('used');
    if (!usedBy && (invite.get('expiresAt') as Timestamp).toMillis() <= now.getTime()) {
      throw new OwnerError('expired');
    }

    const locationName = (location.get('location') as string | undefined) ?? locationId;
    const alreadyOwner = member.get('role') === 'owner';

    if (!alreadyOwner) {
      // set, not create: a 'staff' doc from the old invites may be there.
      tx.set(memberRef, {
        email: user.email,
        role: 'owner',
        joinedAt: FieldValue.serverTimestamp(),
        invitedBy: invite.get('createdBy') ?? null,
      });
    }
    if (!usedBy && !alreadyOwner) {
      tx.update(ref, { usedBy: user.uid, usedByEmail: user.email, usedAt: Timestamp.fromDate(now) });
    }

    const locationIds = Array.from(new Set([...listedLocations(pointer), locationId]));
    // A brand-new account starts caught up rather than with every update.
    const lastSeenUpdate = pointer.exists ? pointer.get('lastSeenUpdate') : LATEST_UPDATE_ID;
    tx.set(pointerRef, {
      locationId,
      locationIds,
      role: 'owner',
      email: user.email,
      ...(typeof lastSeenUpdate === 'string' ? { lastSeenUpdate } : {}),
    });
    return { locationName, alreadyOwner };
  });
}

/**
 * Takes `targetUid` off the location: an owner removing another owner, or
 * someone leaving (`actorUid === targetUid`). Refused if it would leave the
 * location with no owner. Their account's pointer moves to another location
 * they own, or is deleted if there's none (they'll be asked to set one up).
 */
export async function removeOwner(
  db: Firestore,
  locationId: string,
  actorUid: string,
  targetUid: string,
): Promise<void> {
  const membersCol = db.collection(`locations/${locationId}/members`);
  const actorRef = membersCol.doc(actorUid);
  const targetRef = membersCol.doc(targetUid);
  const pointerRef = db.doc(`users/${targetUid}`);

  await db.runTransaction(async (tx) => {
    const [actor, target, owners, pointer] = await Promise.all([
      tx.get(actorRef),
      tx.get(targetRef),
      tx.get(membersCol.where('role', '==', 'owner')),
      tx.get(pointerRef),
    ]);
    if (actor.get('role') !== 'owner') throw new OwnerError('not-owner');
    if (!target.exists) throw new OwnerError('not-found');
    if (target.get('role') === 'owner' && owners.size <= 1) throw new OwnerError('last-owner');

    tx.delete(targetRef);

    if (!pointer.exists) return;
    const remaining = listedLocations(pointer).filter((id) => id !== locationId);
    if (pointer.get('locationId') !== locationId) {
      if (Array.isArray(pointer.get('locationIds'))) tx.update(pointerRef, { locationIds: remaining });
    } else if (remaining.length > 0) {
      tx.update(pointerRef, { locationId: remaining[0], locationIds: remaining });
    } else {
      tx.delete(pointerRef);
    }
  });
}
