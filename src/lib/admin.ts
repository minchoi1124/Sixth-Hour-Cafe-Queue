/**
 * The app's admin: an account given this custom claim by scripts/make-admin.ts,
 * run with the service account. Nothing in the app can grant it. Only the
 * admin makes, hides and clears test locations (`hidden: true` on a location,
 * which leaves it out of the location picker); firestore.rules enforces it.
 */
export const ADMIN_CLAIM = 'admin';
