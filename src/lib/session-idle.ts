/**
 * When a forgotten session counts as idle.
 *
 * People often leave a session running after they pack up, which keeps the
 * ordering page open and stretches the session's end time. A running session
 * with no new orders for SESSION_IDLE_MS is ended automatically (see
 * src/lib/auto-end-session.ts), with its end time set back to the last order.
 */

export const SESSION_IDLE_MS = 3 * 60 * 60 * 1000;

/**
 * The moment the session went quiet: its last order, or its start if no
 * order came in after it started. This is also the end time an idle session
 * is given.
 */
export function idleSince(startsAt: Date, lastOrderAt: Date | null): Date {
  return lastOrderAt && lastOrderAt > startsAt ? lastOrderAt : startsAt;
}

export function isIdle(startsAt: Date, lastOrderAt: Date | null, now: Date): boolean {
  return now.getTime() - idleSince(startsAt, lastOrderAt).getTime() >= SESSION_IDLE_MS;
}
