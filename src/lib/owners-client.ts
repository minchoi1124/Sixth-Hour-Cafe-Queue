'use client';

import type { User } from 'firebase/auth';
import { getAppCheckToken } from '@/firebase';

/**
 * Calls one of the /api/owners/* routes as `user` (or signed out, for the
 * invite preview). Throws an Error carrying the route's message on failure.
 */
export async function callOwnersApi<T>(
  path: 'invite' | 'invite-info' | 'accept' | 'remove',
  body: Record<string, unknown>,
  user: User | null,
): Promise<T> {
  const [appCheckToken, idToken] = await Promise.all([getAppCheckToken(), user?.getIdToken() ?? null]);
  const response = await fetch(`/api/owners/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.');
  }
  return data as T;
}

/** The link an invite's secret opens. */
export const inviteUrl = (origin: string, locationId: string, token: string) =>
  `${origin}/invite/${locationId}/${token}`;
