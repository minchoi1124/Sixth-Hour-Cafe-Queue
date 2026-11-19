import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { acceptOwnerInvite, isInviteToken } from '@/lib/owners';
import { fail, isLocationId, ownerErrorResponse, readRequest, signInFirst } from '@/lib/owners-api';

/** The signed-in account accepts an invite link and becomes a co-owner. */
export async function POST(req: NextRequest) {
  const request = await readRequest(req, 'owners/accept');
  if (request instanceof NextResponse) return request;
  const { body, account } = request;
  if (!account) return signInFirst();
  if (!isLocationId(body.locationId) || !isInviteToken(body.token)) {
    return fail(404, 'This invite link isn’t valid. Ask for a new one.');
  }

  try {
    const result = await acceptOwnerInvite(getAdminDb(), body.locationId, body.token, account);
    return NextResponse.json(result);
  } catch (e) {
    return ownerErrorResponse(e, 'owners/accept');
  }
}
