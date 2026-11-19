import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { describeOwnerInvite, isInviteToken } from '@/lib/owners';
import { fail, isLocationId, ownerErrorResponse, readRequest } from '@/lib/owners-api';

/** The invite page's preview: which location, still good? Needs no sign-in. */
export async function POST(req: NextRequest) {
  const request = await readRequest(req, 'owners/invite-info');
  if (request instanceof NextResponse) return request;
  const { body } = request;
  if (!isLocationId(body.locationId) || !isInviteToken(body.token)) {
    return fail(404, 'This invite link isn’t valid. Ask for a new one.');
  }

  try {
    const { locationName, expiresAt } = await describeOwnerInvite(getAdminDb(), body.locationId, body.token);
    return NextResponse.json({ locationName, expiresAt: expiresAt.toISOString() });
  } catch (e) {
    return ownerErrorResponse(e, 'owners/invite-info');
  }
}
