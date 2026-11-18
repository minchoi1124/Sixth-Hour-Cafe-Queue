/**
 * One-time cleanup of the old invite codes, which the passcode rules no
 * longer use:
 *
 *   locations/{id}/private/invite
 *   inviteCodes/*
 *
 * Staff accounts are NOT touched; scripts/promote-staff-to-owners.ts turns
 * them into owners.
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

  const locations = await db.collection('locations').listDocuments();
  for (const location of locations) {
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
