/**
 * Centralized Firestore path helpers for the multi-tenant data model.
 *
 * Every Sixth Hour Cafe location owns an isolated subtree under
 * `locations/{locationId}`. The id is readable and fixed at creation (e.g.
 * `msu-campus`, see `readable-ids.ts`); in code it's still called `cafeId`.
 * Who works there lives inside the location, at `members/{uid}`, so the people
 * at a location sit next to its data. A separate top-level `slugs/{slug}`
 * collection maps the public, changeable link to a locationId so customers can
 * reach it at `/order/{slug}` without logging in.
 */
import {
  type CollectionReference,
  type DocumentData,
  type Firestore,
  collection,
  doc,
  runTransaction,
} from 'firebase/firestore';
import { idPart, pickFreeId } from '@/lib/readable-ids';

// --- Cafe document ---
export const cafeDoc = (db: Firestore, cafeId: string) =>
  doc(db, 'locations', cafeId);

// --- Per-cafe subcollections ---
export const drinksCol = (db: Firestore, cafeId: string) =>
  collection(db, 'locations', cafeId, 'drinks');
export const drinkDoc = (db: Firestore, cafeId: string, id: string) =>
  doc(db, 'locations', cafeId, 'drinks', id);

export const categoriesCol = (db: Firestore, cafeId: string) =>
  collection(db, 'locations', cafeId, 'categories');
export const categoryDoc = (db: Firestore, cafeId: string, id: string) =>
  doc(db, 'locations', cafeId, 'categories', id);

export const ordersCol = (db: Firestore, cafeId: string) =>
  collection(db, 'locations', cafeId, 'orders');
export const orderDoc = (db: Firestore, cafeId: string, id: string) =>
  doc(db, 'locations', cafeId, 'orders', id);

export const sessionsCol = (db: Firestore, cafeId: string) =>
  collection(db, 'locations', cafeId, 'sessions');
export const sessionDoc = (db: Firestore, cafeId: string, id: string) =>
  doc(db, 'locations', cafeId, 'sessions', id);

// Named, reusable menus. A session snapshots one of these when it starts.
export const presetsCol = (db: Firestore, cafeId: string) =>
  collection(db, 'locations', cafeId, 'presets');
export const presetDoc = (db: Firestore, cafeId: string, id: string) =>
  doc(db, 'locations', cafeId, 'presets', id);

// How to make each drink. Keyed by drink id, so a drink has at most one recipe
// and looking one up needs no query.
export const recipesCol = (db: Firestore, cafeId: string) =>
  collection(db, 'locations', cafeId, 'recipes');
export const recipeDoc = (db: Firestore, cafeId: string, drinkId: string) =>
  doc(db, 'locations', cafeId, 'recipes', drinkId);

/**
 * `addDoc`, but the id is made from `name` (e.g. `matcha-latte`, or
 * `matcha-latte-2` if taken) so the document reads clearly in the console and
 * in every array that references it. Returns the id.
 */
export async function addDocWithReadableId(
  db: Firestore,
  col: CollectionReference,
  name: string,
  data: DocumentData,
): Promise<string> {
  return runTransaction(db, async (tx) => {
    const id = await pickFreeId(
      idPart(name, 30, 'item'),
      async (candidate) => (await tx.get(doc(col, candidate))).exists(),
    );
    tx.set(doc(col, id), data);
    return id;
  });
}

// --- Public slug -> cafe lookup ---
export const slugDoc = (db: Firestore, slug: string) =>
  doc(db, 'slugs', slug);

// --- Membership ---
// Everyone with access to a location — owners and staff alike — has a
// `locations/{locationId}/members/{uid}` doc, and that doc is what the rules
// check. `users/{uid}` is only a pointer from a signed-in account to its
// location, so login can find it without a query. Invite codes map a shared
// code to a location so staff can join. The owner's current code is kept in a
// private subdoc that only owners can read.
export const membersCol = (db: Firestore, cafeId: string) =>
  collection(db, 'locations', cafeId, 'members');
export const memberDoc = (db: Firestore, cafeId: string, uid: string) =>
  doc(db, 'locations', cafeId, 'members', uid);
export const userDoc = (db: Firestore, uid: string) =>
  doc(db, 'users', uid);
export const inviteCodeDoc = (db: Firestore, code: string) =>
  doc(db, 'inviteCodes', code);
export const cafeInviteDoc = (db: Firestore, cafeId: string) =>
  doc(db, 'locations', cafeId, 'private', 'invite');

/** Generate a random, unambiguous invite code (e.g. "7K2PQX9R"). */
export function generateInviteCode(length = 8): string {
  // No 0/O/1/I to avoid confusion when read aloud or typed.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) code += alphabet[values[i] % alphabet.length];
  return code;
}

// --- Slug validation ---

/** Lowercase letters, digits and hyphens; 3-30 chars; no leading/trailing hyphen. */
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

/** Route names and other paths that must never be claimed as a cafe slug. */
export const RESERVED_SLUGS = new Set([
  'login',
  'logout',
  'signup',
  'signin',
  'staff',
  'order',
  'orders',
  'onboarding',
  'join',
  'admin',
  'api',
  'app',
  'about',
  'help',
  'guide',
  'support',
  'settings',
  'account',
  'cafes',
  'locations',
  'users',
  'slugs',
  'new',
  'edit',
]);

export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug) && !RESERVED_SLUGS.has(slug);
}

/** Normalize arbitrary user input into a candidate slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/g, '');
}
