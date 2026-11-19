import { NextRequest, NextResponse } from 'next/server';
import { rejectWithoutAppCheck } from '@/lib/app-check-server';
import { OwnerError, type OwnerErrorCode } from '@/lib/owners';
import { signedInAccount, type SignedInAccount } from '@/lib/verify-id-token';

// Shared plumbing for the /api/owners/* routes (src/lib/owners.ts does the work).

const LOCATION_ID_REGEX = /^[a-z0-9-]{1,60}$/;
export const isLocationId = (value: unknown): value is string =>
  typeof value === 'string' && LOCATION_ID_REGEX.test(value);

const MESSAGES: Record<OwnerErrorCode, [number, string]> = {
  'not-owner': [403, 'Only an owner of this location can do that.'],
  invalid: [404, 'This invite link isn’t valid. Ask for a new one.'],
  used: [410, 'This invite link has already been used. Ask for a new one.'],
  expired: [410, 'This invite link has expired. Ask for a new one.'],
  'too-many': [429, 'This location has too many unused invite links. Revoke some in Settings first.'],
  'last-owner': [409, 'A location needs at least one owner. Invite someone else first.'],
  'not-found': [404, 'That person isn’t on this location any more.'],
};

export const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/** The JSON body, App Check and (unless `anonymous`) the signed-in account. */
export async function readRequest(
  req: NextRequest,
  tag: string,
): Promise<{ body: Record<string, unknown>; account: SignedInAccount | null } | NextResponse> {
  const rejected = await rejectWithoutAppCheck(req, tag);
  if (rejected) return rejected;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON');
  }
  if (typeof body !== 'object' || body === null) return fail(400, 'Invalid JSON');
  return { body: body as Record<string, unknown>, account: await signedInAccount(req) };
}

export const signInFirst = () => fail(401, 'Sign in to your account first.');

/** Turns an OwnerError into its response; anything else is a 500. */
export function ownerErrorResponse(e: unknown, tag: string): NextResponse {
  if (e instanceof OwnerError) {
    const [status, message] = MESSAGES[e.code];
    return NextResponse.json({ error: message, code: e.code }, { status });
  }
  console.error(`[${tag}]`, e);
  return fail(500, 'Something went wrong. Please try again.');
}
