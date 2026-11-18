import { randomUUID, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { rejectWithoutAppCheck } from '@/lib/app-check-server';
import { createCustomToken } from '@/lib/custom-token';
import {
  DEFAULT_STAFF_PASSCODE,
  PASSCODE_MAX_LENGTH,
  STAFF_LOCATION_CLAIM,
  STAFF_PASSCODE_VERSION_CLAIM,
  normalizePasscode,
} from '@/lib/staff-passcode';

// Staff sign-in: location + passcode in, a Firebase custom token out. See
// src/lib/staff-passcode.ts for how the token's claims are checked by the rules.

// Wrong passcodes per location before it pauses, which keeps guessing
// impractical. The pause is short so someone guessing on purpose can't keep
// real staff out for long.
const MAX_FAILURES = 10;
const WINDOW_MS = 10 * 60 * 1000;

const LOCATION_ID_REGEX = /^[a-z0-9-]{1,60}$/;

/** Compares ignoring case and extra spaces (see normalizePasscode). */
function samePasscode(typed: string, saved: string): boolean {
  const left = Buffer.from(normalizePasscode(typed));
  const right = Buffer.from(normalizePasscode(saved));
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(req: NextRequest) {
  const rejected = await rejectWithoutAppCheck(req, 'staff-signin');
  if (rejected) return rejected;

  let body: { locationId?: unknown; passcode?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { locationId, passcode } = body;
  if (typeof locationId !== 'string' || !LOCATION_ID_REGEX.test(locationId)) {
    return NextResponse.json({ error: 'Pick a location.' }, { status: 400 });
  }
  if (
    typeof passcode !== 'string'
    || normalizePasscode(passcode).length === 0
    || passcode.length > PASSCODE_MAX_LENGTH * 2
  ) {
    return NextResponse.json({ error: 'Enter the staff passcode.' }, { status: 400 });
  }

  const db = getAdminDb();
  const locationRef = db.doc(`locations/${locationId}`);
  const passcodeRef = db.doc(`locations/${locationId}/private/staffPasscode`);
  const attemptsRef = db.doc(`locations/${locationId}/private/staffPasscodeAttempts`);

  // Check the passcode and count the attempt in one transaction, so parallel
  // guesses can't slip past the limit.
  const result = await db.runTransaction(async (tx) => {
    const [location, saved, attempts] = await Promise.all([
      tx.get(locationRef),
      tx.get(passcodeRef),
      tx.get(attemptsRef),
    ]);
    if (!location.exists) return { status: 'missing' as const };

    const now = Date.now();
    const windowStart = (attempts.get('windowStart') as number | undefined) ?? 0;
    const inWindow = now - windowStart < WINDOW_MS;
    const failures = inWindow ? ((attempts.get('failures') as number | undefined) ?? 0) : 0;
    if (failures >= MAX_FAILURES) return { status: 'locked' as const };

    const expected = (saved.get('passcode') as string | undefined) ?? DEFAULT_STAFF_PASSCODE;
    if (!samePasscode(passcode, expected)) {
      tx.set(attemptsRef, { failures: failures + 1, windowStart: inWindow ? windowStart : now });
      return { status: 'wrong' as const };
    }
    if (failures > 0) tx.delete(attemptsRef);
    return {
      status: 'ok' as const,
      passcodeVersion: (location.get('staffPasscodeVersion') as number | undefined) ?? 0,
    };
  });

  switch (result.status) {
    case 'missing':
      return NextResponse.json({ error: 'That location no longer exists.' }, { status: 404 });
    case 'locked':
      return NextResponse.json(
        { error: 'Too many wrong passcodes. Wait 10 minutes and try again.' },
        { status: 429 },
      );
    case 'wrong':
      return NextResponse.json({ error: 'Wrong passcode. Ask your location owner for it.' }, { status: 403 });
  }

  // Each device gets its own uid, so signing one out never affects another.
  const token = await createCustomToken(`staff-${randomUUID()}`, {
    [STAFF_LOCATION_CLAIM]: locationId,
    [STAFF_PASSCODE_VERSION_CLAIM]: result.passcodeVersion,
  });
  return NextResponse.json({ token });
}
