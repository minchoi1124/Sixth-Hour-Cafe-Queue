/**
 * One-time migration: introduce the drink library, presets and per-session menus.
 *
 * Before this, `drinks` was both the library and the live menu, with `inStock`
 * deciding what customers saw. That conflated "we don't serve this any more"
 * with "we just ran out". Now the library holds every recipe, a preset is a
 * named menu, and each session snapshots one.
 *
 * This script:
 *   1. Creates a "Current Menu" preset per cafe from SEED_MENU below. Not from
 *      `inStock`: those flags record what ran out last service and were never
 *      reset, so they read as "everything is out" at migration time.
 *   2. Reconstructs `menuIds` on past sessions from the drinks their orders
 *      actually contained, so history shows what was really served rather than
 *      nothing.
 *   3. Sets `soldOutIds: []` on every session that lacks it.
 *
 * `inStock` and `order` are left in place, unread, the same way `archived` was
 * retired on orders.
 *
 * ── How to run ──────────────────────────────────────────────────────────────
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *     npx tsx scripts/backfill-menus.ts            # dry run
 *   ...same with --commit                          # writes
 *
 * Safe to re-run: cafes that already have a "Current Menu" preset are skipped,
 * and sessions that already carry menuIds are left alone. A cafe with a running
 * session is skipped entirely — end it first, or its menu gets reconstructed
 * from partial orders.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

/** Firestore caps a batch at 500 ops; stay under with room to spare. */
const BATCH_LIMIT = 450;
const PRESET_NAME = 'Current Menu';

/**
 * Drinks to seed the starting preset with, in display order.
 *
 * Deliberately NOT derived from `inStock`. Those flags record what ran out
 * during the last service and were never reset — which is the very confusion
 * this feature removes — so at migration time they read as "everything is out
 * except lemonade". These are the four the busiest sessions actually served.
 * Matched case-insensitively; anything missing is reported, not silently
 * dropped.
 */
const SEED_MENU = [
  'dalgona coffee',
  'maple matcha latte',
  'london fog',
  'apple cider chai',
];

type OrderItem = { id: string; name: string };

async function main() {
  const commit = hasFlag('commit');

  if (!getApps().length) {
    initializeApp({ credential: applicationDefault() });
  }
  const db = getFirestore();

  console.log(`\n${commit ? 'BACKFILLING' : 'DRY RUN'} menus\n`);

  const cafes = await db.collection('cafes').get();
  if (cafes.empty) {
    console.log('No cafes found.');
    return;
  }

  for (const cafeSnap of cafes.docs) {
    const cafeId = cafeSnap.id;
    const label = (cafeSnap.get('location') as string | undefined) ?? cafeId;

    const drinks = await db.collection(`cafes/${cafeId}/drinks`).get();
    if (drinks.empty) {
      console.log(`cafes/${cafeId} (${label}): no drinks, skipping`);
      continue;
    }

    // A running session would get its menu reconstructed from the orders placed
    // so far, which understates what's actually being served. End it first.
    const activeSessionId = cafeSnap.get('activeSessionId') as string | null | undefined;
    if (activeSessionId) {
      console.log(
        `cafes/${cafeId} (${label}): session ${activeSessionId} is still ACTIVE — ` +
          'end it in the app before migrating this cafe. Skipping.',
      );
      continue;
    }

    // --- 1. Seed the starting preset ---
    const byName = new Map(
      drinks.docs.map((d) => [String(d.get('name') ?? '').trim().toLowerCase(), d]),
    );
    const seeded = SEED_MENU.map((name) => byName.get(name)).filter(
      (d): d is FirebaseFirestore.QueryDocumentSnapshot => d !== undefined,
    );
    const unmatched = SEED_MENU.filter((name) => !byName.has(name));
    if (unmatched.length > 0) {
      console.log(`  ! not found in this cafe's library: ${unmatched.join(', ')}`);
    }

    const existing = await db
      .collection(`cafes/${cafeId}/presets`)
      .where('name', '==', PRESET_NAME)
      .limit(1)
      .get();

    if (existing.empty) {
      console.log(
        `cafes/${cafeId} (${label}): preset "${PRESET_NAME}" from ${seeded.length} drink(s)`,
      );
      for (const d of seeded) console.log(`    - ${d.get('name')}`);
      if (commit && seeded.length > 0) {
        await db.collection(`cafes/${cafeId}/presets`).add({
          name: PRESET_NAME,
          drinkIds: seeded.map((d) => d.id),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } else {
      console.log(`cafes/${cafeId} (${label}): preset "${PRESET_NAME}" already exists, skipping`);
    }

    // --- 2 & 3. Reconstruct each session's menu from its orders ---
    const sessions = await db.collection(`cafes/${cafeId}/sessions`).get();
    if (sessions.empty) {
      console.log('  no sessions to backfill');
      continue;
    }

    const knownDrinkIds = new Set(drinks.docs.map((d) => d.id));
    let batch = db.batch();
    let ops = 0;
    let updated = 0;

    for (const sessionSnap of sessions.docs) {
      const hasMenu = Array.isArray(sessionSnap.get('menuIds'));
      const hasSoldOut = Array.isArray(sessionSnap.get('soldOutIds'));
      if (hasMenu && hasSoldOut) continue;

      const update: Record<string, unknown> = {};

      if (!hasMenu) {
        // What was actually served, in first-appearance order. Orders store the
        // drink id, so this survives renames.
        const orders = await db
          .collection(`cafes/${cafeId}/orders`)
          .where('sessionId', '==', sessionSnap.id)
          .where('status', '==', 'completed')
          .get();

        const seen: string[] = [];
        for (const orderSnap of orders.docs) {
          for (const item of (orderSnap.get('items') as OrderItem[] | undefined) ?? []) {
            // Skip drinks deleted from the library since; resolveMenu would
            // drop them at read time anyway.
            if (item?.id && knownDrinkIds.has(item.id) && !seen.includes(item.id)) {
              seen.push(item.id);
            }
          }
        }
        update.menuIds = seen;
        console.log(
          `  session ${sessionSnap.id}: ${seen.length} drink(s) reconstructed from ${orders.size} order(s)`,
        );
      }

      if (!hasSoldOut) update.soldOutIds = [];

      batch.update(sessionSnap.ref, update);
      ops++;
      updated++;
      if (ops >= BATCH_LIMIT) {
        if (commit) await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }

    if (ops > 0 && commit) await batch.commit();
    console.log(`  → ${updated} session(s) updated`);
  }

  console.log(`\nDone.${commit ? '' : ' (dry run — re-run with --commit to write)'}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
