/**
 * Corrects the end time of past sessions that were left running.
 *
 * Before sessions ended on their own (src/lib/auto-end-session.ts), a session
 * someone forgot to end kept running until whoever noticed, so its end time
 * says the service ran for hours longer than it did. This applies the same
 * rule after the fact: an ended session whose end time is SESSION_IDLE_MS (3
 * hours) or more after its last order gets `endedAt` moved back to that last
 * order (or to its start, if nobody ordered).
 *
 * The old value is kept in `originalEndedAt` (with `endedAtCorrected: true`),
 * so a correction can be undone by hand. Sessions ended within 3 hours of their
 * last order are left alone. Stats aren't touched: they come from the orders,
 * not the end time.
 *
 * ── How to run ──────────────────────────────────────────────────────────────
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *     npx tsx scripts/fix-idle-session-times.ts            # 1. dry run: lists the changes
 *   ...same with --commit                                  # 2. apply them
 * Safe to re-run: a corrected session is within 3 hours of its last order.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { SESSION_IDLE_MS, idleSince } from '../src/lib/session-idle';

const commit = process.argv.includes('--commit');

const asDate = (value: unknown): Date | null =>
  value instanceof Timestamp ? value.toDate() : null;

const hours = (ms: number) => `${(ms / 3_600_000).toFixed(1)}h`;
const when = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

async function main() {
  if (!getApps().length) initializeApp({ credential: applicationDefault() });
  const db = getFirestore();
  console.log(`\n${commit ? 'CORRECTING' : 'DRY RUN (pass --commit to apply)'}\n`);

  let total = 0;
  const writer = commit ? db.bulkWriter() : null;

  const locations = await db.collection('locations').listDocuments();
  for (const location of locations) {
    const sessions = await location.collection('sessions').where('status', '==', 'ended').get();
    if (sessions.empty) continue;

    // Every order's session and time, in one read, instead of a query per session.
    const lastOrderBySession = new Map<string, Date>();
    const orders = await location.collection('orders').select('sessionId', 'createdAt').get();
    for (const order of orders.docs) {
      const sessionId = order.get('sessionId') as string | null | undefined;
      const createdAt = asDate(order.get('createdAt'));
      if (!sessionId || !createdAt) continue;
      const latest = lastOrderBySession.get(sessionId);
      if (!latest || createdAt > latest) lastOrderBySession.set(sessionId, createdAt);
    }

    for (const session of sessions.docs) {
      const startsAt = asDate(session.get('startsAt'));
      const endedAt = asDate(session.get('endedAt'));
      if (!startsAt || !endedAt) continue;

      const correctEnd = idleSince(startsAt, lastOrderBySession.get(session.id) ?? null);
      const extra = endedAt.getTime() - correctEnd.getTime();
      if (extra < SESSION_IDLE_MS) continue;

      total += 1;
      console.log(
        `  ${location.id} / ${session.id}\n`
        + `      ended ${when(endedAt)}  ->  ${when(correctEnd)}  (${hours(extra)} after its last order)`,
      );
      writer?.update(session.ref, {
        endedAt: Timestamp.fromDate(correctEnd),
        originalEndedAt: Timestamp.fromDate(endedAt),
        endedAtCorrected: true,
      });
    }
  }

  if (writer) await writer.close();
  console.log(`\n${total} session(s) ${commit ? 'corrected' : 'would be corrected'}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
