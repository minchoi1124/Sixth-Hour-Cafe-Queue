/**
 * Statistics derived from session snapshots and order timestamps.
 *
 * Two sources, deliberately kept apart:
 *
 *   - **Totals** come from the stats frozen onto each session when it ended
 *     (`drinkCount`, `itemCounts`). Cheap, and already loaded by the staff page.
 *   - **Timing** comes from the orders' own `createdAt`. This matters: eight of
 *     the ten sessions are `backfilled`, meaning the sessions migration
 *     reconstructed their `startsAt`/`endedAt` from order dates rather than
 *     recording them. Those session timestamps are inferred and must never be
 *     used to measure how long a service ran; the order timestamps are genuine.
 *
 * Everything here is pure and Firebase-free so it can be reasoned about (and
 * tested) without a database.
 */
import type { Order, Session } from '@/lib/definitions';
import { toDate } from '@/lib/sessions';

/** Orders that count toward totals: cancelled ones were never made. */
export function isCounted(order: Order): boolean {
  return order.status !== 'cancelled';
}

export function drinksIn(order: Order): number {
  return order.items?.length ?? 0;
}

// --- 1. Drinks per session ---------------------------------------------------

export type SessionPoint = {
  sessionId: string;
  label: string;
  location: string;
  date: Date | null;
  drinks: number;
  backfilled: boolean;
};

/**
 * One point per session, oldest first.
 *
 * Ordered by session rather than plotted on a real time axis on purpose: these
 * services are irregular — a cluster in autumn, then months of nothing — and a
 * true date axis would be mostly empty space with the data crushed into one
 * corner.
 */
export function sessionSeries(
  sessions: Session[],
  formatLabel: (date: Date) => string,
): SessionPoint[] {
  return sessions
    .filter((s) => s.status === 'ended')
    .map((s) => {
      const date = toDate(s.startsAt);
      return {
        sessionId: s.id,
        label: date ? formatLabel(date) : 'Undated',
        location: s.location,
        date,
        drinks: s.drinkCount ?? 0,
        backfilled: Boolean(s.backfilled),
      };
    })
    .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
}

// --- 2. Drink leaderboard ----------------------------------------------------

export type DrinkTotal = { name: string; drinks: number; sessions: number };

/**
 * All-time totals per drink, summed across every session's frozen `itemCounts`.
 *
 * Keyed by drink name rather than id because that's what `itemCounts` records —
 * a deliberate part of freezing stats, so renaming or deleting a recipe can't
 * rewrite history.
 */
export function drinkLeaderboard(sessions: Session[]): DrinkTotal[] {
  const totals = new Map<string, { drinks: number; sessions: number }>();
  for (const session of sessions) {
    for (const [name, count] of Object.entries(session.itemCounts ?? {})) {
      const entry = totals.get(name) ?? { drinks: 0, sessions: 0 };
      entry.drinks += count;
      entry.sessions += 1;
      totals.set(name, entry);
    }
  }
  return [...totals.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.drinks - a.drinks || a.name.localeCompare(b.name));
}

// --- 3. Throughput -----------------------------------------------------------

/** Below either threshold, a drinks-per-hour figure is too noisy to rank on. */
export const MIN_RELIABLE_MINUTES = 30;
export const MIN_RELIABLE_DRINKS = 20;

export type Throughput = {
  sessionId: string;
  label: string;
  location: string;
  drinks: number;
  /** Minutes from first to last order. Null when a session has under 2 orders. */
  spanMinutes: number | null;
  /** Drinks per hour across that span, or null when the span is unusable. */
  perHour: number | null;
  /**
   * Whether the rate is worth comparing. A short or tiny service divides a
   * handful of drinks by a few minutes and lands at the top of the chart: an
   * 11-drink test session over 10 minutes reads as 64/hr, faster than a real
   * 164-drink service. Flagged rather than dropped, so the session still
   * appears with its rate shown as provisional.
   */
  reliable: boolean;
  firstOrder: Date | null;
  lastOrder: Date | null;
};

/**
 * How fast each service actually ran, measured from first order to last.
 *
 * A single-order session has no span to divide by, so `perHour` is null rather
 * than infinity — the caller renders it as "—" instead of a fabricated rate.
 */
export function throughput(
  sessions: Session[],
  ordersBySession: Map<string, Order[]>,
  formatLabel: (date: Date) => string,
): Throughput[] {
  return sessions
    .filter((s) => s.status === 'ended')
    .map((session) => {
      const orders = (ordersBySession.get(session.id) ?? []).filter(isCounted);
      const times = orders
        .map((o) => new Date(o.createdAt))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

      const first = times[0] ?? null;
      const last = times[times.length - 1] ?? null;
      const spanMinutes =
        first && last && times.length > 1 ? (last.getTime() - first.getTime()) / 60000 : null;
      const drinks = orders.reduce((n, o) => n + drinksIn(o), 0);

      const sessionDate = toDate(session.startsAt);
      return {
        sessionId: session.id,
        label: sessionDate ? formatLabel(sessionDate) : 'Undated',
        location: session.location,
        drinks,
        spanMinutes,
        perHour: spanMinutes && spanMinutes > 0 ? (drinks / spanMinutes) * 60 : null,
        reliable:
          spanMinutes !== null &&
          spanMinutes >= MIN_RELIABLE_MINUTES &&
          drinks >= MIN_RELIABLE_DRINKS,
        firstOrder: first,
        lastOrder: last,
      };
    })
    // Reliable rates first, so a 10-minute test session can't head the ranking;
    // provisional ones still follow, ranked among themselves.
    .sort((a, b) => {
      if (a.reliable !== b.reliable) return a.reliable ? -1 : 1;
      return (b.perHour ?? -1) - (a.perHour ?? -1);
    });
}

// --- 4. Rush curve -----------------------------------------------------------

export type RushBucket = { start: Date; label: string; drinks: number };

export const BUCKET_MINUTES = 15;

/**
 * Drinks per 15-minute window across one session.
 *
 * Empty windows in the middle are emitted as zeroes so a lull reads as a dip
 * rather than silently closing the gap and flattening the curve.
 */
export function rushCurve(
  orders: Order[],
  formatTime: (date: Date) => string,
): RushBucket[] {
  const times = orders
    .filter(isCounted)
    .flatMap((o) => {
      const at = new Date(o.createdAt);
      return Number.isNaN(at.getTime()) ? [] : [{ at, drinks: drinksIn(o) }];
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  if (times.length === 0) return [];

  const size = BUCKET_MINUTES * 60_000;
  const floor = (d: Date) => Math.floor(d.getTime() / size) * size;
  const start = floor(times[0].at);
  const end = floor(times[times.length - 1].at);

  const counts = new Map<number, number>();
  for (const { at, drinks } of times) {
    const key = floor(at);
    counts.set(key, (counts.get(key) ?? 0) + drinks);
  }

  const buckets: RushBucket[] = [];
  for (let t = start; t <= end; t += size) {
    const at = new Date(t);
    buckets.push({ start: at, label: formatTime(at), drinks: counts.get(t) ?? 0 });
  }
  return buckets;
}

/** Busiest window in a curve, for calling out the peak in prose. */
export function peakBucket(buckets: RushBucket[]): RushBucket | null {
  if (buckets.length === 0) return null;
  return buckets.reduce((best, b) => (b.drinks > best.drinks ? b : best));
}

/** Group orders by the session they belong to, dropping orphans. */
export function groupOrdersBySession(orders: Order[]): Map<string, Order[]> {
  const bySession = new Map<string, Order[]>();
  for (const order of orders) {
    if (!order.sessionId) continue;
    const list = bySession.get(order.sessionId);
    if (list) list.push(order);
    else bySession.set(order.sessionId, [order]);
  }
  return bySession;
}
