'use server';

import { getAdminDb } from './firebase-admin';
import type { MenuItem, Cafe } from './definitions';

/** Resolve a public cafe slug to its cafe record, or null if it doesn't exist. */
export const getCafeBySlug = async (slug: string): Promise<Cafe | null> => {
  try {
    const adminDb = getAdminDb();
    const slugSnap = await adminDb.doc(`slugs/${slug}`).get();
    if (!slugSnap.exists) return null;
    const cafeId = slugSnap.data()!.cafeId as string;

    const cafeSnap = await adminDb.doc(`cafes/${cafeId}`).get();
    if (!cafeSnap.exists) return null;

    return { id: cafeSnap.id, ...(cafeSnap.data() as Omit<Cafe, 'id'>) };
  } catch (error) {
    console.error(`Failed to resolve cafe for slug "${slug}":`, error);
    return null;
  }
};

export const getMenuForCafe = async (cafeId: string): Promise<MenuItem[]> => {
  try {
    const snapshot = await getAdminDb()
      .collection(`cafes/${cafeId}/drinks`)
      .orderBy('order', 'asc')
      .get();
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as MenuItem);
  } catch (error) {
    console.error('Failed to fetch menu:', error);
    return [];
  }
};

/**
 * What to show a customer when the cafe is closed.
 *
 * Prefers the next scheduled session, so the page can say when it opens and
 * preview that menu. Falls back to the most recent ended session, which at
 * least shows what's usually served.
 *
 * Runs through the Admin SDK, which bypasses security rules — `sessions` is
 * staff-only, so an unauthenticated client could not read this itself.
 */
export type NextOpening = {
  /** ISO string, or null when nothing is scheduled. */
  startsAt: string | null;
  location: string | null;
  /** Drink ids to preview, greyed out. */
  menuIds: string[];
};

export const getNextOpening = async (cafeId: string): Promise<NextOpening | null> => {
  try {
    const sessions = getAdminDb().collection(`cafes/${cafeId}/sessions`);

    const scheduled = await sessions
      .where('status', '==', 'scheduled')
      .orderBy('startsAt', 'asc')
      .limit(1)
      .get();

    if (!scheduled.empty) {
      const doc = scheduled.docs[0];
      return {
        startsAt: doc.get('startsAt')?.toDate?.().toISOString() ?? null,
        location: (doc.get('location') as string | undefined) ?? null,
        menuIds: (doc.get('menuIds') as string[] | undefined) ?? [],
      };
    }

    // Nothing planned — preview the last menu served so the page isn't bare.
    const previous = await sessions
      .where('status', '==', 'ended')
      .orderBy('startsAt', 'desc')
      .limit(1)
      .get();

    if (previous.empty) return null;
    const doc = previous.docs[0];
    return {
      startsAt: null,
      location: (doc.get('location') as string | undefined) ?? null,
      menuIds: (doc.get('menuIds') as string[] | undefined) ?? [],
    };
  } catch (error) {
    console.error('Failed to resolve next opening:', error);
    return null;
  }
};
