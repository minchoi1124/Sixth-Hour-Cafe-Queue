/**
 * Human-readable Firestore document IDs.
 *
 * The data is mostly read in the Firebase console, which lists documents by ID
 * and sorts them as strings. Random IDs made that a wall of noise: a session's
 * `menuIds` was a list of gibberish, and orders showed up in no useful order.
 * These helpers build IDs that say what the document is and, where time
 * matters, sort chronologically:
 *
 *   locations/msu-campus
 *   drinks/matcha-latte
 *   sessions/2026-10-24_library-2nd-floor_k3f9
 *   orders/2026-10-24_14-32-05_min_a1b2
 *
 * IDs are assigned once and never change. Renaming a drink or editing a
 * session's start time leaves the ID as it was; the fields stay the source of
 * truth and the ID is only a label.
 *
 * This module imports nothing from Firebase so the Node migration script and
 * the Admin SDK routes can share it with the client.
 */
import { zonedDateKey, zonedTimestampKey } from './timezone';

/**
 * Lowercase ASCII words joined by hyphens, cut to `maxLength`. Falls back when
 * nothing survives (e.g. a name written entirely in non-Latin script).
 */
export function idPart(input: string, maxLength: number, fallback: string): string {
  const part = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, '');
  return part || fallback;
}

const SUFFIX_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/** A short random tag that keeps same-second, same-name IDs from colliding. */
export function randomSuffix(length = 4): string {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  let suffix = '';
  for (let i = 0; i < length; i++) suffix += SUFFIX_ALPHABET[values[i] % SUFFIX_ALPHABET.length];
  return suffix;
}

/** e.g. `2026-10-24_library-2nd-floor_k3f9`, dated in the location's timezone. */
export function sessionDocId(startsAt: Date, venue: string, tz: string, suffix = randomSuffix()): string {
  return `${zonedDateKey(startsAt, tz)}_${idPart(venue, 24, 'session')}_${suffix}`;
}

/** e.g. `2026-10-24_14-32-05_min_a1b2`, timed in the location's timezone. */
export function orderDocId(createdAt: Date, customerName: string, tz: string, suffix = randomSuffix()): string {
  return `${zonedTimestampKey(createdAt, tz)}_${idPart(customerName, 16, 'guest')}_${suffix}`;
}

/**
 * The first of `base`, `base-2` … `base-9` that `isTaken` rejects, then
 * `base-<random>`. Used for name-derived IDs (locations, drinks, categories,
 * presets) where two things can share a name.
 */
export async function pickFreeId(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
): Promise<string> {
  if (!(await isTaken(base))) return base;
  for (let n = 2; n <= 9; n++) {
    const candidate = `${base}-${n}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `${base}-${randomSuffix()}`;
}
