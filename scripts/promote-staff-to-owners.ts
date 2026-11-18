/**
 * Gives every staff account the same access as the owner of its location.
 *
 * Staff accounts from the old invite system have role 'staff', which the
 * passcode rules no longer give any access. This sets role 'owner' on
 *
 *   locations/{id}/members/{uid}   (what the rules check)
 *   users/{uid}                    (the pointer login uses, if it points here)
 *
 * so they keep logging in with their own account, as co-owners. Check the
 * staff list first (dry run, or Firestore → locations → each location →
 * members in the Firebase console): only people you trust with the whole
 * location should be promoted.
 *
 * ── How to run ──────────────────────────────────────────────────────────────
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *     npx tsx scripts/promote-staff-to-owners.ts            # 1. dry run: lists them
 *   ...same with --commit                                   # 2. promote them
 * Safe to re-run. Works with both the old and the new app and rules.
 * In CI (public logs) emails are left out of the output.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const commit = process.argv.includes('--commit');
// Exit non-zero if any staff accounts are left (dry run only).
const requireNone = !commit && process.argv.includes('--require-none');
const showEmails = !process.env.CI;

async function main() {
  if (!getApps().length) initializeApp({ credential: applicationDefault() });
  const db = getFirestore();
  console.log(`\n${commit ? 'PROMOTING' : 'DRY RUN (pass --commit to promote)'}\n`);

  let total = 0;
  const writer = commit ? db.bulkWriter() : null;

  const locations = await db.collection('locations').listDocuments();
  for (const location of locations) {
    const staff = await location.collection('members').where('role', '==', 'staff').get();
    if (staff.empty) continue;
    console.log(`  ${location.id}: ${staff.size} staff account(s)`);

    for (const member of staff.docs) {
      total += 1;
      if (showEmails) console.log(`    - ${member.get('email') ?? '(no email)'}`);
      if (!writer) continue;
      writer.update(member.ref, { role: 'owner' });
      const pointer = db.doc(`users/${member.id}`);
      const snap = await pointer.get();
      if (snap.exists && snap.get('locationId') === location.id) {
        writer.update(pointer, { role: 'owner' });
      }
    }
  }

  if (writer) await writer.close();
  console.log(`\n${total} staff account(s) ${commit ? 'promoted to owner' : 'would be promoted to owner'}.`);

  // Used by the deploy: refuse to go live while anyone would lose access.
  if (requireNone && total > 0) {
    console.error('Staff accounts have not been promoted yet. Not deploying.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
