import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { createOwnerInvite } from '@/lib/owners';
import { fail, isLocationId, ownerErrorResponse, readRequest, signInFirst } from '@/lib/owners-api';

/** An owner makes a co-owner invite link. Returns its secret; the page builds the URL. */
export async function POST(req: NextRequest) {
  const request = await readRequest(req, 'owners/invite');
  if (request instanceof NextResponse) return request;
  const { body, account } = request;
  if (!account) return signInFirst();
  if (!isLocationId(body.locationId)) return fail(400, 'Missing location.');

  try {
    const { token, expiresAt } = await createOwnerInvite(getAdminDb(), body.locationId, account);
    return NextResponse.json({ token, expiresAt: expiresAt.toISOString() });
  } catch (e) {
    return ownerErrorResponse(e, 'owners/invite');
  }
}
