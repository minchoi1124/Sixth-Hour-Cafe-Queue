/**
 * One-time cleanup after switching staff to location passcodes.
 *
 * Staff used to join with an invite code and get their own account. The rules
 * no longer give those accounts any access, so this only removes the leftover
 * data:
 *
 *   locations/{id}/members/{uid}  where role == 'staff'
 *   users/{uid}                   where role == 'staff'
 *   locations/{id}/private/invite
 *   inviteCodes/*
 *
 * Owners' members and users docs are left alone. The staff accounts
 * themselves stay in Firebase Auth; delete them from the console if you want.
 *
 * ── How to run ──────────────────────────────────────────────────────────────
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *     npx tsx scripts/remove-staff-invites.ts            # 1. dry run: lists what would go
 *   ...same with --commit                                # 2. delete it
 * Run it after deploying the app and `firebase deploy --only firestore`.
 * Safe to re-run.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, type DocumentReference } from 'firebase-admin/firestore';

const commit = process.argv.includes('--commit');

async function main() {
  if (!getApps().length) initializeApp({ credential: applicationDefault() });
  const db = getFirestore();
  console.log(`\n${commit ? 'DELETING' : 'DRY RUN (pass --commit to delete)'}\n`);

  const doomed: DocumentReference[] = [];

  const staffUsers = await db.collection('users').where('role', '==', 'staff').get();
  for (const doc of staffUsers.docs) {
    console.log(`  pointer  ${doc.ref.path}  (${doc.get('email') ?? 'no email'})`);
    doomed.push(doc.ref);
  }

  const locations = await db.collection('locations').listDocuments();
  for (const location of locations) {
    const staffMembers = await location.collection('members').where('role', '==', 'staff').get();
    for (const doc of staffMembers.docs) {
      console.log(`  member   ${doc.ref.path}  (${doc.get('email') ?? 'no email'})`);
      doomed.push(doc.ref);
    }

    const invite = location.collection('private').doc('invite');
    if ((await invite.get()).exists) {
      console.log(`  invite   ${invite.path}`);
      doomed.push(invite);
    }
  }

  const codes = await db.collection('inviteCodes').listDocuments();
  for (const code of codes) {
    console.log(`  code     ${code.path}`);
    doomed.push(code);
  }

  console.log(`\n${doomed.length} doc(s) ${commit ? 'to delete' : 'would be deleted'}.`);
  if (!commit || doomed.length === 0) return;

  const writer = db.bulkWriter();
  for (const ref of doomed) writer.delete(ref);
  await writer.close();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
