/**
 * Centralized Firestore path helpers for the multi-tenant data model.
 *
 * Every cafe owns an isolated subtree under `cafes/{cafeId}` where
 * `cafeId === the owner's Firebase Auth uid`. A separate top-level
 * `slugs/{slug}` collection maps a public, human-friendly slug to a cafeId so
 * customers can reach a specific cafe at `/order/{slug}` without logging in.
 */
import {
  type Firestore,
  collection,
  doc,
} from 'firebase/firestore';

// --- Cafe document ---
export const cafeDoc = (db: Firestore, cafeId: string) =>
  doc(db, 'cafes', cafeId);

// --- Per-cafe subcollections ---
export const drinksCol = (db: Firestore, cafeId: string) =>
  collection(db, 'cafes', cafeId, 'drinks');
export const drinkDoc = (db: Firestore, cafeId: string, id: string) =>
  doc(db, 'cafes', cafeId, 'drinks', id);

export const categoriesCol = (db: Firestore, cafeId: string) =>
  collection(db, 'cafes', cafeId, 'categories');
export const categoryDoc = (db: Firestore, cafeId: string, id: string) =>
  doc(db, 'cafes', cafeId, 'categories', id);

export const ordersCol = (db: Firestore, cafeId: string) =>
  collection(db, 'cafes', cafeId, 'orders');
export const orderDoc = (db: Firestore, cafeId: string, id: string) =>
  doc(db, 'cafes', cafeId, 'orders', id);

export const sessionsCol = (db: Firestore, cafeId: string) =>
  collection(db, 'cafes', cafeId, 'sessions');
export const sessionDoc = (db: Firestore, cafeId: string, id: string) =>
  doc(db, 'cafes', cafeId, 'sessions', id);

// --- Public slug -> cafe lookup ---
export const slugDoc = (db: Firestore, slug: string) =>
  doc(db, 'slugs', slug);

// --- Staff membership ---
// A staff member's membership lives at userCafes/{uid}; owners have no such doc
// (they're resolved by `cafes/{uid}` existing). Invite codes map a shared code
// to a cafe so staff can join. The owner's current code is kept in a private
// subdoc that only the owner can read.
export const userCafeDoc = (db: Firestore, uid: string) =>
  doc(db, 'userCafes', uid);
export const userCafesCol = (db: Firestore) =>
  collection(db, 'userCafes');
export const inviteCodeDoc = (db: Firestore, code: string) =>
  doc(db, 'inviteCodes', code);
export const cafeInviteDoc = (db: Firestore, cafeId: string) =>
  doc(db, 'cafes', cafeId, 'private', 'invite');

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
  'support',
  'settings',
  'account',
  'cafes',
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
