/**
 * One-time migration: reconstruct sessions from the order history that predates
 * the sessions feature.
 *
 * Before sessions existed, the staff page derived its drink counter by summing
 * every order with status `completed`, and "Clear History" hid old ones by
 * flipping them to `archived`. This script groups all of that history into one
 * session per calendar date (in each cafe's timezone), freezes each session's
 * stats, and stamps every order with its `sessionId`.
 *
 * It also collapses `archived` back into `completed` — sessions replaced the
 * reason `archived` existed, so keeping it would hide drinks from the totals.
 *
 * ── How to run ──────────────────────────────────────────────────────────────
 * 1. Get a service-account key: Firebase console → Project settings →
 *    Service accounts → "Generate new private key" (do NOT commit it).
 * 2. Dry run first — it writes nothing without --commit:
 *      GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *        npx tsx scripts/backfill-sessions.ts
 * 3. Check that the session count matches your operating dates and that the
 *    summed drink count equals the All-Time number the app showed before.
 * 4. Re-run with --commit.
 *
 * Safe to re-run: orders that already carry a sessionId are skipped.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { cafeTimezone, zonedDateKey } from '../src/lib/timezone';

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

/** Firestore caps a batch at 500 ops; stay under with room to spare. */
const BATCH_LIMIT = 450;

type OrderItem = { id: string; name: string; modifications: string[] };
type OrderData = {
  customerName?: string;
  items?: OrderItem[];
  status?: string;
  sessionId?: string | null;
  createdAt?: Timestamp;
};

async function main() {
  const commit = hasFlag('commit');

  if (!getApps().length) {
    initializeApp({ credential: applicationDefault() });
  }
  const db = getFirestore();

  console.log(`\n${commit ? 'BACKFILLING' : 'DRY RUN'} sessions\n`);

  const cafes = await db.collection('cafes').get();
  if (cafes.empty) {
    console.log('No cafes found.');
    return;
  }

  let grandTotalDrinks = 0;
  let grandTotalSessions = 0;

  for (const cafeSnap of cafes.docs) {
    const cafeId = cafeSnap.id;
    const tz = cafeTimezone(cafeSnap.get('timezone') as string | undefined);
    const cafeLocation = (cafeSnap.get('location') as string | undefined) ?? 'Sixth Hour Cafe';

    const orders = await db.collection(`cafes/${cafeId}/orders`).get();
    if (orders.empty) {
      console.log(`cafes/${cafeId} (${cafeLocation}): no orders, skipping`);
      continue;
    }

    // Group the history — completed and legacy archived alike — by local date.
    const byDate = new Map<string, { ref: FirebaseFirestore.DocumentReference; data: OrderData }[]>();
    // Everything else (pending, cancelled, and any history already assigned)
    // just needs the field to exist so `where('sessionId','==',null)` matches.
    const needsNullField: FirebaseFirestore.DocumentReference[] = [];

    for (const orderSnap of orders.docs) {
      const data = orderSnap.data() as OrderData;
      const alreadyAssigned = typeof data.sessionId === 'string' && data.sessionId.length > 0;
      const isHistory = data.status === 'completed' || data.status === 'archived';
      const createdAt = data.createdAt;

      if (alreadyAssigned) continue; // idempotent re-run

      if (isHistory && createdAt) {
        const key = zonedDateKey(createdAt.toDate(), tz);
        const bucket = byDate.get(key) ?? [];
        bucket.push({ ref: orderSnap.ref, data });
        byDate.set(key, bucket);
      } else if (data.sessionId === undefined) {
        needsNullField.push(orderSnap.ref);
      }
    }

    const dates = [...byDate.keys()].sort();
    let cafeDrinks = 0;

    console.log(
      `cafes/${cafeId} (${cafeLocation}, ${tz}): ${orders.size} order(s) → ` +
        `${dates.length} session(s), ${needsNullField.length} order(s) need sessionId: null`,
    );

    let batch = db.batch();
    let ops = 0;
    const flushIfFull = async () => {
      if (ops >= BATCH_LIMIT) {
        if (commit) await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    };

    for (const date of dates) {
      const bucket = byDate.get(date)!;
      const times = bucket
        .map((o) => o.data.createdAt!.toMillis())
        .sort((a, b) => a - b);

      const itemCounts: Record<string, number> = {};
      let drinkCount = 0;
      for (const { data } of bucket) {
        for (const item of data.items ?? []) {
          itemCounts[item.name] = (itemCounts[item.name] ?? 0) + 1;
          drinkCount++;
        }
      }
      cafeDrinks += drinkCount;

      const sessionRef = db.collection(`cafes/${cafeId}/sessions`).doc();
      batch.set(sessionRef, {
        location: cafeLocation,
        startsAt: Timestamp.fromMillis(times[0]),
        endedAt: Timestamp.fromMillis(times[times.length - 1]),
        status: 'ended',
        drinkCount,
        orderCount: bucket.length,
        itemCounts,
        statsUpdatedAt: FieldValue.serverTimestamp(),
        backfilled: true,
      });
      ops++;
      await flushIfFull();

      for (const { ref } of bucket) {
        // `archived` collapses into `completed`: sessions replaced the "hide it
        // from the counter" role that status used to play.
        batch.update(ref, { sessionId: sessionRef.id, status: 'completed' });
        ops++;
        await flushIfFull();
      }

      console.log(`  ${date}: ${bucket.length} order(s), ${drinkCount} drink(s)`);
    }

    for (const ref of needsNullField) {
      batch.update(ref, { sessionId: null });
      ops++;
      await flushIfFull();
    }

    if (ops > 0 && commit) await batch.commit();

    console.log(`  → ${dates.length} session(s), ${cafeDrinks} drink(s) total`);
    grandTotalSessions += dates.length;
    grandTotalDrinks += cafeDrinks;
  }

  console.log(
    `\nDone. ${grandTotalSessions} session(s), ${grandTotalDrinks} drink(s).` +
      `${commit ? '' : ' (dry run — re-run with --commit to write)'}\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
