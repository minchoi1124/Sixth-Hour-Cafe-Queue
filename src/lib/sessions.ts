/**
 * Session lifecycle: start → (adopt orphan orders) → end → stats snapshot.
 *
 * A session is one pop-up service. `cafes/{cafeId}.activeSessionId` points at
 * the one that's running, and every order records the `sessionId` it was placed
 * under. Ending a session freezes its stats onto the session doc so the history
 * view and the all-time counter only ever read session docs — never the whole
 * order collection, which is what the old "Clear History" flow forced.
 */
import {
  type Firestore,
  type Timestamp,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { cafeDoc, ordersCol, sessionDoc, sessionsCol } from '@/lib/cafe-paths';
import type { NewSession, Order, Session } from '@/lib/definitions';

/** Firestore writes over 500 ops fail; stay under with room to spare. */
const BATCH_LIMIT = 450;

export type SessionStats = {
  drinkCount: number;
  orderCount: number;
  itemCounts: Record<string, number>;
};

/** Normalize the several shapes a timestamp field can arrive in. */
export function toDate(value: Timestamp | string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof (value as Timestamp).toDate === 'function') return (value as Timestamp).toDate();
  return null;
}

/** Sum drinks the way the old counter did: one drink per line item. */
export function countDrinks(orders: Pick<Order, 'items'>[]): number {
  return orders.reduce((total, order) => total + (order.items?.length ?? 0), 0);
}

/** Tally drinks by name across orders. */
export function tallyItems(orders: Pick<Order, 'items'>[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const order of orders) {
    for (const item of order.items ?? []) {
      counts[item.name] = (counts[item.name] ?? 0) + 1;
    }
  }
  return counts;
}

/** The `n` most-made drinks, highest first. */
export function topDrinks(
  itemCounts: Record<string, number> | undefined,
  n = 3,
): { name: string; count: number }[] {
  if (!itemCounts) return [];
  return Object.entries(itemCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, n);
}

/** Read every completed order in a session and tally it. One query. */
export async function computeSessionStats(
  db: Firestore,
  cafeId: string,
  sessionId: string,
): Promise<SessionStats> {
  const snapshot = await getDocs(
    query(
      ordersCol(db, cafeId),
      where('sessionId', '==', sessionId),
      where('status', '==', 'completed'),
    ),
  );
  const orders = snapshot.docs.map((d) => d.data() as Pick<Order, 'items'>);
  return {
    drinkCount: countDrinks(orders),
    orderCount: orders.length,
    itemCounts: tallyItems(orders),
  };
}

/**
 * Attach orders placed while no session was running to the session now starting.
 *
 * Safe to run unconditionally: the backfill gave every historical order a
 * sessionId, so a null one can only be a genuine orphan from the current gap.
 */
export async function adoptOrphanOrders(
  db: Firestore,
  cafeId: string,
  sessionId: string,
): Promise<number> {
  const snapshot = await getDocs(
    query(
      ordersCol(db, cafeId),
      where('sessionId', '==', null),
      where('status', 'in', ['pending', 'completed']),
    ),
  );
  if (snapshot.empty) return 0;

  let batch = writeBatch(db);
  let ops = 0;
  for (const orderSnap of snapshot.docs) {
    batch.update(orderSnap.ref, { sessionId });
    ops++;
    if (ops >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  return snapshot.size;
}

/**
 * Slack before a start time counts as "in the future". Without it, the seconds
 * spent filling in the dialog would turn a session meant to start now into a
 * scheduled one — and the button would have said "Start session".
 */
const SCHEDULE_GRACE_MS = 60_000;

/** Whether this start time schedules the session instead of starting it now. */
export function isScheduledStart(startsAt: Date): boolean {
  return startsAt.getTime() > Date.now() + SCHEDULE_GRACE_MS;
}

export type StartSessionResult = {
  sessionId: string;
  /** False when `startsAt` is in the future — the session was only scheduled. */
  started: boolean;
  adoptedOrders: number;
};

/**
 * Create a session. A start time in the future is saved as `scheduled` and does
 * NOT become the active session, so pre-planning next week can't quietly capture
 * tonight's orders.
 */
export async function startSession(
  db: Firestore,
  cafeId: string,
  input: NewSession,
): Promise<StartSessionResult> {
  const ref = doc(sessionsCol(db, cafeId));
  const isFuture = isScheduledStart(input.startsAt);

  await runTransaction(db, async (tx) => {
    const cafeRef = cafeDoc(db, cafeId);
    const cafeSnap = await tx.get(cafeRef);
    const activeSessionId = cafeSnap.get('activeSessionId') as string | null | undefined;
    if (!isFuture && activeSessionId) {
      throw new Error('A session is already running. End it before starting a new one.');
    }

    tx.set(ref, {
      location: input.location,
      startsAt: input.startsAt,
      endedAt: null,
      status: isFuture ? 'scheduled' : 'active',
      menuIds: input.menuIds,
      soldOutIds: [],
      presetId: input.presetId ?? null,
      ...(input.notes ? { notes: input.notes } : {}),
    });
    if (!isFuture) {
      // The public mirror goes out in the same write as activeSessionId, so the
      // cafe can never be "open" without a menu for customers to read.
      tx.update(cafeRef, {
        activeSessionId: ref.id,
        liveMenu: { drinkIds: input.menuIds, soldOutIds: [] },
      });
    }
  });

  const adoptedOrders = isFuture ? 0 : await adoptOrphanOrders(db, cafeId, ref.id);
  return { sessionId: ref.id, started: !isFuture, adoptedOrders };
}

/** Promote a scheduled session to the active one ("Start now"). */
export async function activateSession(
  db: Firestore,
  cafeId: string,
  sessionId: string,
): Promise<number> {
  await runTransaction(db, async (tx) => {
    const cafeRef = cafeDoc(db, cafeId);
    const sessionRef = sessionDoc(db, cafeId, sessionId);
    // Both reads must precede any write inside a transaction.
    const [cafeSnap, sessionSnap] = await Promise.all([tx.get(cafeRef), tx.get(sessionRef)]);

    const activeSessionId = cafeSnap.get('activeSessionId') as string | null | undefined;
    if (activeSessionId && activeSessionId !== sessionId) {
      throw new Error('A session is already running. End it before starting a new one.');
    }

    const menuIds = (sessionSnap.get('menuIds') as string[] | undefined) ?? [];
    const soldOutIds = (sessionSnap.get('soldOutIds') as string[] | undefined) ?? [];

    tx.update(sessionRef, { status: 'active' });
    tx.update(cafeRef, {
      activeSessionId: sessionId,
      liveMenu: { drinkIds: menuIds, soldOutIds },
    });
  });

  return adoptOrphanOrders(db, cafeId, sessionId);
}

/** End the active session: freeze its stats and clear the cafe's pointer. */
export async function endSession(
  db: Firestore,
  cafeId: string,
  sessionId: string,
): Promise<SessionStats> {
  // Computed first: transactions and batches can't run queries.
  const stats = await computeSessionStats(db, cafeId, sessionId);

  // A batch is enough here — nothing needs reading, only the two writes need to
  // land together so the cafe never points at a session already marked ended.
  const batch = writeBatch(db);
  batch.update(sessionDoc(db, cafeId, sessionId), {
    ...stats,
    status: 'ended',
    endedAt: serverTimestamp(),
    statsUpdatedAt: serverTimestamp(),
  });
  // Clearing liveMenu is what closes the ordering page — it must go out with
  // activeSessionId, never separately.
  batch.update(cafeDoc(db, cafeId), { activeSessionId: null, liveMenu: null });
  await batch.commit();

  return stats;
}

/**
 * Replace the running session's menu.
 *
 * Session and public mirror are written in one batch so customers can never see
 * a menu that disagrees with what staff have set. The preset the menu came from
 * is deliberately untouched — see `savePresetFromSession` for the explicit
 * write-back.
 */
export async function setSessionMenu(
  db: Firestore,
  cafeId: string,
  sessionId: string,
  menuIds: string[],
  soldOutIds: string[] = [],
): Promise<void> {
  // Anything sold out but no longer on the menu is meaningless; drop it.
  const menuSet = new Set(menuIds);
  const prunedSoldOut = soldOutIds.filter((id) => menuSet.has(id));

  const batch = writeBatch(db);
  batch.update(sessionDoc(db, cafeId, sessionId), {
    menuIds,
    soldOutIds: prunedSoldOut,
  });
  batch.update(cafeDoc(db, cafeId), {
    liveMenu: { drinkIds: menuIds, soldOutIds: prunedSoldOut },
  });
  await batch.commit();
}

/**
 * Mark a drink sold out (or back in) for this session only.
 *
 * The mid-rush action: it must be one tap and it must not leak into the next
 * session, which is why availability lives on the session rather than on the
 * drink document.
 */
export async function toggleSoldOut(
  db: Firestore,
  cafeId: string,
  sessionId: string,
  menuIds: string[],
  soldOutIds: string[],
  drinkId: string,
  soldOut: boolean,
): Promise<void> {
  const next = soldOut
    ? Array.from(new Set([...soldOutIds, drinkId]))
    : soldOutIds.filter((id) => id !== drinkId);

  const batch = writeBatch(db);
  batch.update(sessionDoc(db, cafeId, sessionId), { soldOutIds: next });
  batch.update(cafeDoc(db, cafeId), {
    liveMenu: { drinkIds: menuIds, soldOutIds: next },
  });
  await batch.commit();
}

/**
 * Re-freeze an ended session's stats. Used after an order is deleted from a
 * past session so the card doesn't keep quoting a number that no longer holds.
 */
export async function recomputeSessionStats(
  db: Firestore,
  cafeId: string,
  sessionId: string,
): Promise<SessionStats> {
  const stats = await computeSessionStats(db, cafeId, sessionId);
  await updateDoc(sessionDoc(db, cafeId, sessionId), {
    ...stats,
    statsUpdatedAt: serverTimestamp(),
  });
  return stats;
}

/**
 * Location to prefill the start dialog with: the most recent session's venue,
 * falling back to the cafe's branch label. `sessions` is expected newest-first.
 */
export function suggestedLocation(
  sessions: Session[] | null | undefined,
  cafeLocation: string | undefined,
): string {
  return sessions?.[0]?.location || cafeLocation || '';
}
