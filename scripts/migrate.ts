/**
 * One-time migration: move the original single-cafe data from the legacy
 * top-level collections (`drinks`, `categories`, `orders`, `counters`) into the
 * new multi-tenant layout under `cafes/{ownerUid}/...`, and register the public
 * slug.
 *
 * After the public launch refactor, every cafe's data lives under
 * `cafes/{cafeId}` where `cafeId === the owner's Firebase Auth uid`. This script
 * assigns ALL existing legacy data to YOUR new account so your cafe keeps
 * working; everyone else starts fresh.
 *
 * ── How to run ──────────────────────────────────────────────────────────────
 * 1. Sign up in the app with your real account, then grab your uid from the
 *    Firebase console (Authentication → Users) or `firebase auth:export`.
 * 2. Get a service-account key: Firebase console → Project settings →
 *    Service accounts → "Generate new private key". Save the JSON somewhere safe
 *    (do NOT commit it).
 * 3. Install dev deps (one-off):
 *      npm i -D firebase-admin tsx
 * 4. Run (it does a dry run unless you pass --commit):
 *      GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *        npx tsx scripts/migrate.ts --uid=<YOUR_UID> --slug=<your-slug> \
 *        --location="MSU Campus" --commit
 * 5. Verify the data at /staff and /order/<your-slug>, then delete the legacy
 *    top-level collections from the Firebase console once you're happy.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const LEGACY_COLLECTIONS = ['drinks', 'categories', 'orders', 'counters'] as const;
const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

async function main() {
  const uid = arg('uid');
  const slug = arg('slug');
  // Every cafe is a Sixth Hour Cafe; `location` is the branch/operator label.
  const location = arg('location') ?? arg('name') ?? 'Main';
  const commit = hasFlag('commit');

  if (!uid || !slug) {
    console.error('Missing required args. Example:\n' +
      '  npx tsx scripts/migrate.ts --uid=ABC123 --slug=msu --location="MSU Campus" --commit');
    process.exit(1);
  }
  if (!SLUG_REGEX.test(slug)) {
    console.error(`Invalid slug "${slug}": use 3-30 lowercase letters, numbers, hyphens.`);
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({ credential: applicationDefault() });
  }
  const db = getFirestore();

  console.log(`\n${commit ? 'MIGRATING' : 'DRY RUN'} → cafes/${uid} (slug: ${slug})\n`);

  // Guard: don't clobber an existing slug owned by someone else.
  const slugSnap = await db.doc(`slugs/${slug}`).get();
  if (slugSnap.exists && slugSnap.get('cafeId') !== uid) {
    console.error(`Slug "${slug}" is already taken by ${slugSnap.get('cafeId')}. Aborting.`);
    process.exit(1);
  }

  if (commit) {
    await db.doc(`cafes/${uid}`).set(
      { location, slug, createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    await db.doc(`slugs/${slug}`).set({ cafeId: uid });
    console.log(`✓ Created cafes/${uid} and slugs/${slug}`);
  }

  for (const col of LEGACY_COLLECTIONS) {
    const snap = await db.collection(col).get();
    console.log(`${col}: ${snap.size} doc(s)`);
    if (!commit || snap.empty) continue;

    // Batch in chunks of 450 (Firestore limit is 500 ops/batch).
    let batch = db.batch();
    let ops = 0;
    for (const docSnap of snap.docs) {
      const target = db.doc(`cafes/${uid}/${col}/${docSnap.id}`);
      batch.set(target, docSnap.data());
      ops++;
      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
    console.log(`  ✓ copied ${snap.size} ${col} into cafes/${uid}/${col}`);
  }

  console.log(
    `\nDone.${commit ? '' : ' (dry run — re-run with --commit to write)'}` +
    `\nLegacy top-level collections were left intact; delete them once verified.\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
