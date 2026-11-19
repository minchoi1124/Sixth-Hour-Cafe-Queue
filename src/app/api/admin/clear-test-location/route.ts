import { NextRequest, NextResponse } from 'next/server';
import { rejectWithoutAppCheck } from '@/lib/app-check-server';
import { getAdminDb } from '@/lib/firebase-admin';
import { fail, isLocationId } from '@/lib/owners-api';
import { TestLocationError, clearTestLocation, type TestLocationErrorCode } from '@/lib/test-locations';
import { signedInAdmin } from '@/lib/verify-id-token';

const MESSAGES: Record<TestLocationErrorCode, [number, string]> = {
  'not-found': [404, 'That location doesn’t exist any more.'],
  'not-owner': [403, 'You aren’t an owner of this location.'],
  'not-hidden': [409, 'Only a hidden test location can be cleared.'],
};

/** The admin deletes a test location's orders and sessions (src/lib/test-locations.ts). */
export async function POST(req: NextRequest) {
  const rejected = await rejectWithoutAppCheck(req, 'admin/clear-test-location');
  if (rejected) return rejected;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON');
  }
  const locationId = (body as { locationId?: unknown } | null)?.locationId;
  if (!isLocationId(locationId)) return fail(400, 'Missing location.');

  const admin = await signedInAdmin(req);
  if (!admin) return fail(403, 'Only the admin can clear test locations.');

  try {
    const cleared = await clearTestLocation(getAdminDb(), locationId, admin.uid);
    return NextResponse.json(cleared);
  } catch (e) {
    if (e instanceof TestLocationError) {
      const [status, message] = MESSAGES[e.code];
      return NextResponse.json({ error: message, code: e.code }, { status });
    }
    console.error('[admin/clear-test-location]', e);
    return fail(500, 'Something went wrong. Please try again.');
  }
}
