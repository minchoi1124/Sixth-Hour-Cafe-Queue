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

export const countersCol = (db: Firestore, cafeId: string) =>
  collection(db, 'cafes', cafeId, 'counters');

// --- Public slug -> cafe lookup ---
export const slugDoc = (db: Firestore, slug: string) =>
  doc(db, 'slugs', slug);

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
