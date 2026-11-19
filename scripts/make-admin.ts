/**
 * Makes an account the app's admin (src/lib/admin.ts), or stops it being one.
 * The admin is the only account that can create, hide and clear test
 * locations. This script is the only way to grant it: nothing in the app can.
 *
 * ── How to run (PowerShell) ─────────────────────────────────────────────────
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccount.json"
 *   npm.cmd run make-admin -- you@example.com          # 1. dry run: shows the account
 *   ...same with --commit                               # 2. make it the admin
 *   ...with --remove --commit                           #    or take it away
 * Then sign out of the app and back in, so the sign-in picks up the change.
 * Other claims on the account are kept. Safe to re-run.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { existsSync } from 'node:fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { ADMIN_CLAIM } from '../src/lib/admin';

const args = process.argv.slice(2);
const commit = args.includes('--commit');
const remove = args.includes('--remove');
const email = args.find((arg) => !arg.startsWith('--'));

async function main() {
  if (!email) {
    console.error('Usage: npm run make-admin -- <email> [--remove] [--commit]');
    process.exit(1);
  }
  // A key file (GOOGLE_APPLICATION_CREDENTIALS), or the app's own
  // FIREBASE_SERVICE_ACCOUNT JSON. Without either, firebase-admin only says
  // "Unable to detect a Project Id", so say what's missing instead.
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const keyJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!keyFile && !keyJson) {
    console.error(
      'No Firebase credentials. Download a key (Firebase console → Project settings →\n' +
        'Service accounts → Generate new private key), then in PowerShell:\n' +
        '  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\\path\\to\\key.json"',
    );
    process.exit(1);
  }
  if (keyFile && !existsSync(keyFile)) {
    console.error(`GOOGLE_APPLICATION_CREDENTIALS points to a file that isn't there:\n  ${keyFile}`);
    process.exit(1);
  }
  if (!getApps().length) {
    initializeApp({ credential: keyFile ? applicationDefault() : cert(JSON.parse(keyJson!)) });
  }
  const auth = getAuth();

  const user = await auth.getUserByEmail(email);
  const claims = { ...(user.customClaims ?? {}) };
  const isAdmin = claims[ADMIN_CLAIM] === true;
  console.log(`\n${commit ? '' : 'DRY RUN (pass --commit to change it)\n'}`);
  console.log(`  account   ${user.uid} (${user.email})`);
  console.log(`  admin now ${isAdmin ? 'yes' : 'no'}`);

  if (remove ? !isAdmin : isAdmin) {
    console.log(`\nNothing to do: it ${isAdmin ? 'already is' : 'isn’t'} the admin.`);
    return;
  }
  console.log(`  change    ${remove ? 'remove admin' : 'make admin'}`);
  if (!commit) return;

  if (remove) delete claims[ADMIN_CLAIM];
  else claims[ADMIN_CLAIM] = true;
  await auth.setCustomUserClaims(user.uid, claims);
  console.log('\nDone. Sign out of the app and back in to pick it up.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
