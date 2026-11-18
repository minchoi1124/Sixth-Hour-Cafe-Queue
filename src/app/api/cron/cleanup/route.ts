import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { endIdleSessions } from '@/lib/auto-end-session';

// Nightly job, run by a Vercel Cron (see vercel.json):
//  - ends sessions left running with no orders for 3 hours;
//  - purges soft-deleted (cancelled) orders older than a week. Cancelled orders
//    are hidden from every queue and excluded from sales totals, so purging old
//    ones just reclaims space.
//
// Protected by CRON_SECRET: Vercel automatically sends `Authorization: Bearer
// <CRON_SECRET>` with cron invocations when that env var is set.

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 450;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Fail closed. A missing secret used to skip the check entirely, which left a
  // route that mass-deletes orders callable by anyone if the env var ever went
  // missing.
  if (!secret) {
    console.error('[cron/cleanup] CRON_SECRET is not set; refusing to run');
    return NextResponse.json({ error: 'Cleanup is not configured' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // End sessions left running (see src/lib/auto-end-session.ts). Its own
  // try, so a problem here never stops the purge below, or the reverse.
  let autoEnded: string[] = [];
  try {
    autoEnded = await endIdleSessions(getAdminDb());
  } catch (e) {
    console.error('[cron/cleanup] Failed to end idle sessions:', (e as Error)?.message ?? e);
  }

  const cutoff = new Date(Date.now() - ONE_WEEK_MS);

  try {
    const snapshot = await getAdminDb()
      .collectionGroup('orders')
      .where('status', '==', 'cancelled')
      .where('createdAt', '<', cutoff)
      .get();

    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = getAdminDb().batch();
      docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    return NextResponse.json({ deleted: docs.length, cutoff: cutoff.toISOString(), autoEnded });
  } catch (e) {
    // Name the reason. This job silently 500'd nightly for seven weeks because
    // its collection-group index was declared in firestore.indexes.json but
    // never deployed, and a bare "Cleanup failed" gave nothing to go on.
    const message = (e as Error)?.message ?? String(e);
    console.error('[cron/cleanup] Failed to purge cancelled orders:', message);
    const needsIndex = message.includes('requires an index');
    return NextResponse.json(
      {
        error: 'Cleanup failed',
        reason: message,
        ...(needsIndex
          ? { hint: 'Run: firebase deploy --only firestore:indexes' }
          : {}),
      },
      { status: 500 },
    );
  }
}
