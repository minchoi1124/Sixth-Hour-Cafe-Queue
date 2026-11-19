import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { removeOwner } from '@/lib/owners';
import { fail, isLocationId, ownerErrorResponse, readRequest, signInFirst } from '@/lib/owners-api';

/** An owner removes another owner, or leaves (`uid` is their own). */
export async function POST(req: NextRequest) {
  const request = await readRequest(req, 'owners/remove');
  if (request instanceof NextResponse) return request;
  const { body, account } = request;
  if (!account) return signInFirst();
  if (!isLocationId(body.locationId)) return fail(400, 'Missing location.');
  if (typeof body.uid !== 'string' || body.uid.length === 0 || body.uid.length > 128 || body.uid.includes('/')) {
    return fail(400, 'Missing person.');
  }

  try {
    await removeOwner(getAdminDb(), body.locationId, account.uid, body.uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return ownerErrorResponse(e, 'owners/remove');
  }
}
