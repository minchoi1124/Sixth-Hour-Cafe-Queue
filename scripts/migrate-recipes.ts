/**
 * One-time migration: move the orphaned root `recipes` collection under its cafe.
 *
 * The multi-tenant migration (dd81b1b) copied `drinks`, `categories` and
 * `orders` from the root into `cafes/{cafeId}/`, but left `recipes` behind. Every
 * read path in the app is scoped to a cafe subtree and the rules end in a
 * deny-all, so the data survived intact but became unreachable — which is why the
 * how-to-make view disappeared.
 *
 * This script copies each root recipe to `cafes/{cafeId}/recipes/{drinkId}`,
 * keyed by drink id rather than the original random document id, so a drink has
 * at most one recipe and lookups need no query.
 *
 * The root documents are left in place. They're already invisible to the app, and
 * keeping them means this migration is reversible by deleting what it wrote.
 *
 * ── How to run ──────────────────────────────────────────────────────────────
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *     npx tsx scripts/migrate-recipes.ts            # dry run
 *   ...same with --commit                           # writes
 *
 * Safe to re-run: a drink that already has a recipe under its cafe is skipped, so
 * a second run never clobbers edits made in the app after the first.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const hasFlag = (name: string) => process.argv.includes(`--${name}`);
const commit = hasFlag('commit');

if (!getApps().length) {
  initializeApp({ credential: applicationDefault() });
}
const db = getFirestore();

type RootRecipe = {
  id: string;
  drinkId?: string;
  drinkName?: string;
  ingredients?: string[];
  instructions?: string;
};

async function main() {
  console.log(commit ? '=== COMMIT ===' : '=== DRY RUN (pass --commit to write) ===');

  const rootRecipes = await db.collection('recipes').get();
  if (rootRecipes.empty) {
    console.log('No root recipes found. Nothing to do.');
    return;
  }
  console.log(`Found ${rootRecipes.size} recipe(s) at the root.\n`);

  const recipes: RootRecipe[] = rootRecipes.docs.map((d) => ({ id: d.id, ...(d.data() as object) }));

  // Which cafe owns each recipe is decided by which cafe's library contains the
  // drink it points at. The root data predates multi-tenancy and carries no
  // cafeId, so there's nothing else to key on.
  const cafes = await db.collection('cafes').get();
  const ownerOf = new Map<string, { cafeId: string; drinkName: string }>();
  const cafeDrinks = new Map<string, Map<string, string>>();
  for (const cafe of cafes.docs) {
    const drinks = await cafe.ref.collection('drinks').get();
    cafeDrinks.set(cafe.id, new Map(drinks.docs.map((d) => [d.id, d.get('name') as string])));
  }
  for (const [cafeId, drinks] of cafeDrinks) {
    for (const [drinkId, drinkName] of drinks) {
      if (!ownerOf.has(drinkId)) ownerOf.set(drinkId, { cafeId, drinkName });
    }
  }

  let written = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const recipe of recipes) {
    const label = recipe.drinkName ?? recipe.id;
    const drinkId = recipe.drinkId;

    if (!drinkId) {
      console.log(`  SKIP  "${label}" — no drinkId field, nothing to attach it to`);
      unmatched++;
      continue;
    }

    const owner = ownerOf.get(drinkId);
    if (!owner) {
      console.log(`  SKIP  "${label}" — drinkId ${drinkId} is in no cafe's library`);
      unmatched++;
      continue;
    }

    const target = db.collection('cafes').doc(owner.cafeId).collection('recipes').doc(drinkId);
    const existing = await target.get();
    if (existing.exists) {
      console.log(`  SKIP  "${label}" — already has a recipe under cafe ${owner.cafeId}`);
      skipped++;
      continue;
    }

    const ingredients = recipe.ingredients ?? [];
    const instructions = recipe.instructions ?? '';
    console.log(
      `  COPY  "${owner.drinkName}" -> cafes/${owner.cafeId}/recipes/${drinkId}` +
        ` (${ingredients.length} ingredients, ${instructions.split('\n').filter(Boolean).length} steps)`,
    );

    if (commit) {
      await target.set({ ingredients, instructions, updatedAt: FieldValue.serverTimestamp() });
    }
    written++;
  }

  console.log(
    `\n${commit ? 'Wrote' : 'Would write'} ${written}, skipped ${skipped} already present,` +
      ` ${unmatched} unmatched.`,
  );
  if (!commit && written > 0) console.log('Re-run with --commit to apply.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
