import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// Scheduled cleanup of soft-deleted (cancelled) orders older than a week, run by
// a Vercel Cron job (see vercel.json). Cancelled orders are hidden from every
// queue and excluded from sales totals, so purging old ones just reclaims space.
//
// Protected by CRON_SECRET: Vercel automatically sends `Authorization: Bearer
// <CRON_SECRET>` with cron invocations when that env var is set.

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 450;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    return NextResponse.json({ deleted: docs.length, cutoff: cutoff.toISOString() });
  } catch (e) {
    console.error('[cron/cleanup] Failed to purge cancelled orders:', e);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}
