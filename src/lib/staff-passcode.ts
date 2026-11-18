/**
 * Staff sign-in by location passcode.
 *
 * Staff don't have accounts. They pick their location, type its passcode, and
 * `/api/staff-signin` signs the device in with a Firebase custom token
 * carrying two claims: the location, and the location's passcode version. The
 * rules accept that sign-in only while the version still matches
 * `staffPasscodeVersion` on the location doc, so changing the passcode (which
 * bumps the version) signs every staff device out.
 *
 * A passcode is any easy-to-remember phrase, like "blue door 27". Checking it
 * ignores capital letters and extra spaces, since phones capitalize the first
 * letter on their own. It's kept readable at
 * `locations/{id}/private/staffPasscode` (owner-only), so the owner can look
 * it up and share it. A location with none saved uses DEFAULT_STAFF_PASSCODE.
 */

export const DEFAULT_STAFF_PASSCODE = '000000';

export const PASSCODE_MIN_LENGTH = 6;
export const PASSCODE_MAX_LENGTH = 40;

/** Custom-token claim names. Mirrored in firestore.rules. */
export const STAFF_LOCATION_CLAIM = 'staffLocation';
export const STAFF_PASSCODE_VERSION_CLAIM = 'staffPasscodeVersion';

/** `staffPasscodeVersion` on a location doc; absent means 0. */
export const passcodeVersionOf = (cafe: { staffPasscodeVersion?: number } | null | undefined): number =>
  cafe?.staffPasscodeVersion ?? 0;

/** The form two passcodes are compared in: lowercase, single spaces, trimmed. */
export function normalizePasscode(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Why a passcode can't be used, or null when it's fine. */
export function passcodeProblem(input: string): string | null {
  const passcode = normalizePasscode(input);
  if (passcode.length < PASSCODE_MIN_LENGTH) return `Use at least ${PASSCODE_MIN_LENGTH} characters.`;
  if (passcode.length > PASSCODE_MAX_LENGTH) return `Use at most ${PASSCODE_MAX_LENGTH} characters.`;
  return null;
}

const WORDS = [
  'maple', 'latte', 'mocha', 'chai', 'matcha', 'honey', 'vanilla', 'caramel',
  'cocoa', 'cider', 'cinnamon', 'oat', 'foam', 'brew', 'bean', 'roast',
  'sunny', 'cozy', 'golden', 'quiet', 'happy', 'autumn', 'winter', 'spring',
  'lemon', 'peach', 'berry', 'mint', 'almond', 'toffee', 'ginger', 'cream',
];

/** A random, easy-to-say passcode like "golden bean 42". */
export function generateStaffPasscode(): string {
  const values = new Uint32Array(3);
  crypto.getRandomValues(values);
  const first = WORDS[values[0] % WORDS.length];
  let second = WORDS[values[1] % WORDS.length];
  if (second === first) second = WORDS[(values[1] + 1) % WORDS.length];
  return `${first} ${second} ${10 + (values[2] % 90)}`;
}
