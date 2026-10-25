/**
 * One-time migration: `cafes/{ownerUid}` → `locations/{readable-id}`.
 *
 * The original layout was built for one operator. With several locations it
 * reads badly in the Firebase console: every location is a random uid, staff for
 * all locations sit in one flat `userCafes` list, and drinks, sessions and
 * orders all have random ids, so a session's `menuIds` is gibberish and orders
 * list in no useful order. This script copies each cafe into the new layout:
 *
 *   cafes/x9Fk2LqP…                       → locations/msu-campus
 *     drinks/aB3x…                        →   drinks/matcha-latte
 *     categories/…  presets/…             →   categories/espresso  presets/fall-menu
 *     recipes/{old drink id}              →   recipes/matcha-latte
 *     sessions/Qz9…                       →   sessions/2026-10-24_library_qz9a
 *     orders/Lm7…                         →   orders/2026-10-24_14-32-05_min_lm7c
 *     private/invite                      →   private/invite
 *   (owner uid, userCafes where cafeId)   →   members/{uid}  { email, role }
 *   userCafes/{uid}                       → users/{uid}  { locationId, role, email }
 *   slugs/{slug}, inviteCodes/{code}      → gain `locationId`
 *
 * Every reference is rewritten to the new ids: `activeSessionId`, `liveMenu`,
 * session `menuIds`/`soldOutIds`/`presetId`, preset `drinkIds`, and order
 * `sessionId`/`items[].id`. Ids for deleted drinks are left as they were.
 *
 * ── How to run ──────────────────────────────────────────────────────────────
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *     npx tsx scripts/migrate-readable-ids.ts             # 1. dry run
 *   ...same with --commit                                 # 2. copy
 *   deploy the app + `firebase deploy --only firestore`   # 3. cut over
 *   ...same with --commit again                           # 4. catch stragglers
 *   ...same with --commit --cleanup                       # 5. delete old data
 *
 * Safe to re-run. The old → new id maps are kept in `_migration/{ownerUid}`
 * (admin-only; the rules deny it), and session and order ids are derived from
 * the old id, so every run gives a doc the same new id. A cafe that already has
 * a record is in catch-up mode: only docs missing from `locations/` are
 * created, and nothing already there is touched, since by step 4 the new app
 * owns that data. That's how step 4 picks up orders placed on the old app
 * between 2 and 3 without reverting anything done on the new one.
 *
 * Old data is untouched until --cleanup, and slugs/invite codes keep their
 * `cafeId` until then, so the deployed app keeps working throughout step 2.
 * --cleanup deletes `cafes/` and `userCafes/` and drops `cafeId` from slugs and
 * invite codes. Run it only once the new app has been checked.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  getFirestore,
  FieldValue,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase-admin/firestore';
import { idPart, orderDocId, sessionDocId } from '../src/lib/readable-ids';
import { cafeTimezone } from '../src/lib/timezone';

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

/** gRPC status for a `create` that hit an existing doc. */
const ALREADY_EXISTS = 6;

type IdMap = Record<string, string>;

/** What a previous run assigned, so re-runs give every doc the same new id. */
type MigrationRecord = {
  locationId: string;
  drinks: IdMap;
  categories: IdMap;
  presets: IdMap;
};

/** A stable 4-character suffix from the old id, so re-runs are deterministic. */
const suffixFrom = (oldId: string) => idPart(oldId, 4, 'x').replace(/-/g, '').padEnd(4, 'x');

/**
 * Extend `existing` with new ids for docs it doesn't cover yet, made from each
 * doc's name and kept unique within `taken`.
 */
function assignNameIds(
  docs: QueryDocumentSnapshot[],
  existing: IdMap,
  fallback: string,
  taken: Set<string> = new Set(Object.values(existing)),
): IdMap {
  const map: IdMap = { ...existing };
  // Oldest id first, so which of two same-named drinks gets the bare name is
  // stable between runs.
  for (const d of [...docs].sort((a, b) => a.id.localeCompare(b.id))) {
    if (map[d.id]) continue;
    const base = idPart((d.get('name') as string | undefined) ?? '', 30, fallback);
    let candidate = base;
    for (let n = 2; taken.has(candidate); n++) candidate = `${base}-${n}`;
    taken.add(candidate);
    map[d.id] = candidate;
  }
  return map;
}

const remap = (ids: unknown, map: IdMap): string[] =>
  Array.isArray(ids) ? ids.map((id) => map[id as string] ?? (id as string)) : [];

const toDate = (value: unknown): Date | null =>
  value && typeof (value as Timestamp).toDate === 'function' ? (value as Timestamp).toDate() : null;

async function main() {
  const commit = hasFlag('commit');
  const cleanup = hasFlag('cleanup');
  if (cleanup && !commit) {
    console.error('--cleanup deletes data; pass --commit with it.');
    process.exit(1);
  }

  if (!getApps().length) initializeApp({ credential: applicationDefault() });
  const db = getFirestore();
  const auth = getAuth();

  if (cleanup) {
    await runCleanup(db);
    return;
  }

  console.log(`\n${commit ? 'MIGRATING' : 'DRY RUN'}\n`);

  const [cafes, userCafes, slugs, inviteCodes, existingLocations] = await Promise.all([
    db.collection('cafes').get(),
    db.collection('userCafes').get(),
    db.collection('slugs').get(),
    db.collection('inviteCodes').get(),
    db.collection('locations').get(),
  ]);

  // Location ids already in use — by an earlier run, or created by the new app.
  const takenLocationIds = new Set(existingLocations.docs.map((d) => d.id));
  const owners = new Set(cafes.docs.map((d) => d.id));
  const writer = db.bulkWriter();
  // ALREADY_EXISTS is how catch-up mode skips docs; don't retry it.
  writer.onWriteError((e) => e.code !== ALREADY_EXISTS && e.failedAttempts < 5);
  let skipped = 0;
  const failures: string[] = [];
  const setDoc = (path: string, data: DocumentData) => {
    if (commit) writer.set(db.doc(path), data).catch((e) => failures.push(`${path}: ${e.message}`));
  };
  const createIfMissing = (path: string, data: DocumentData) => {
    if (!commit) return;
    writer.create(db.doc(path), data).catch((e) => {
      if (e.code === ALREADY_EXISTS) skipped++;
      else failures.push(`${path}: ${e.message}`);
    });
  };

  // Oldest first, so the first location by a name gets the bare id.
  const ordered = [...cafes.docs].sort(
    (a, b) =>
      (toDate(a.get('createdAt'))?.getTime() ?? 0) - (toDate(b.get('createdAt'))?.getTime() ?? 0) ||
      a.id.localeCompare(b.id),
  );

  for (const cafe of ordered) {
    const uid = cafe.id;
    const data = cafe.data();
    const tz = cafeTimezone(data.timezone as string | undefined);
    const recordRef = db.doc(`_migration/${uid}`);
    const previous = (await recordRef.get()).data() as MigrationRecord | undefined;
    const catchUp = previous !== undefined;
    // Data docs: copied outright the first time, only filled in after that.
    const write = catchUp ? createIfMissing : setDoc;

    let locationId = previous?.locationId;
    if (!locationId) {
      const base = idPart((data.location as string | undefined) ?? '', 30, 'location');
      locationId = base;
      for (let n = 2; takenLocationIds.has(locationId); n++) locationId = `${base}-${n}`;
      takenLocationIds.add(locationId);
    }
    const root = `locations/${locationId}`;

    const [drinks, categories, presets, recipes, sessions, orders, invite] = await Promise.all([
      cafe.ref.collection('drinks').get(),
      cafe.ref.collection('categories').get(),
      cafe.ref.collection('presets').get(),
      cafe.ref.collection('recipes').get(),
      cafe.ref.collection('sessions').get(),
      cafe.ref.collection('orders').get(),
      cafe.ref.collection('private').doc('invite').get(),
    ]);

    const drinkMap = assignNameIds(drinks.docs, previous?.drinks ?? {}, 'drink');
    const categoryMap = assignNameIds(categories.docs, previous?.categories ?? {}, 'category');
    const presetMap = assignNameIds(presets.docs, previous?.presets ?? {}, 'preset');
    const sessionMap: IdMap = {};
    for (const s of sessions.docs) {
      const startsAt = toDate(s.get('startsAt')) ?? new Date(0);
      sessionMap[s.id] = sessionDocId(startsAt, (s.get('location') as string) ?? '', tz, suffixFrom(s.id));
    }

    // --- Location doc --- (catch-up leaves it: the new app's copy is live)
    const liveMenu = data.liveMenu as { drinkIds?: string[]; soldOutIds?: string[] } | null | undefined;
    if (!catchUp) setDoc(root, {
      ...data,
      activeSessionId: data.activeSessionId ? sessionMap[data.activeSessionId] ?? null : null,
      liveMenu: liveMenu
        ? { drinkIds: remap(liveMenu.drinkIds, drinkMap), soldOutIds: remap(liveMenu.soldOutIds, drinkMap) }
        : null,
    });

    for (const d of drinks.docs) write(`${root}/drinks/${drinkMap[d.id]}`, d.data());
    for (const c of categories.docs) write(`${root}/categories/${categoryMap[c.id]}`, c.data());
    for (const p of presets.docs) {
      write(`${root}/presets/${presetMap[p.id]}`, {
        ...p.data(),
        drinkIds: remap(p.get('drinkIds'), drinkMap),
      });
    }
    for (const r of recipes.docs) write(`${root}/recipes/${drinkMap[r.id] ?? r.id}`, r.data());
    for (const s of sessions.docs) {
      const presetId = s.get('presetId') as string | null | undefined;
      write(`${root}/sessions/${sessionMap[s.id]}`, {
        ...s.data(),
        menuIds: remap(s.get('menuIds'), drinkMap),
        soldOutIds: remap(s.get('soldOutIds'), drinkMap),
        presetId: presetId ? presetMap[presetId] ?? presetId : null,
      });
    }
    for (const o of orders.docs) {
      const createdAt = toDate(o.get('createdAt')) ?? new Date(0);
      const sessionId = o.get('sessionId') as string | null | undefined;
      const items = ((o.get('items') as { id: string }[] | undefined) ?? []).map((item) => ({
        ...item,
        id: drinkMap[item.id] ?? item.id,
      }));
      write(`${root}/orders/${orderDocId(createdAt, (o.get('customerName') as string) ?? '', tz, suffixFrom(o.id))}`, {
        ...o.data(),
        items,
        sessionId: sessionId ? sessionMap[sessionId] ?? sessionId : null,
      });
    }
    if (invite.exists) write(`${root}/private/invite`, invite.data()!);

    // --- People and lookups --- (first run only)
    let ownerEmail: string | null = null;
    try {
      ownerEmail = (await auth.getUser(uid)).email ?? null;
    } catch {
      console.warn(`  ! no auth user for owner ${uid}; email left empty`);
    }
    const staff = userCafes.docs.filter((m) => m.get('cafeId') === uid);
    const ownSlugs = slugs.docs.filter((s) => s.get('cafeId') === uid);
    const ownCodes = inviteCodes.docs.filter((c) => c.get('cafeId') === uid);
    if (!catchUp) {
      setDoc(`${root}/members/${uid}`, {
        email: ownerEmail,
        role: 'owner',
        joinedAt: data.createdAt ?? FieldValue.serverTimestamp(),
      });
      setDoc(`users/${uid}`, { locationId, role: 'owner', email: ownerEmail });

      for (const m of staff) {
        setDoc(`${root}/members/${m.id}`, {
          email: m.get('email') ?? null,
          role: 'staff',
          ...(m.get('code') ? { code: m.get('code') } : {}),
          joinedAt: m.get('joinedAt') ?? FieldValue.serverTimestamp(),
        });
        // Someone who owns a location resolves to it, as they did before.
        if (!owners.has(m.id)) {
          setDoc(`users/${m.id}`, { locationId, role: 'staff', email: m.get('email') ?? null });
        }
      }

      // Lookups gain locationId but keep cafeId until cleanup, so the old app
      // keeps resolving links while both are live.
      for (const s of ownSlugs) setDoc(`slugs/${s.id}`, { cafeId: uid, locationId });
      for (const c of ownCodes) setDoc(`inviteCodes/${c.id}`, { cafeId: uid, locationId });
    }

    // Always rewritten: catch-up may have assigned ids to drinks added since.
    setDoc(recordRef.path, {
      locationId,
      drinks: drinkMap,
      categories: categoryMap,
      presets: presetMap,
    } satisfies MigrationRecord);

    console.log(
      `cafes/${uid} → ${root}  (${data.location ?? '?'}, owner ${ownerEmail ?? '?'})` +
        (catchUp ? '  [catch-up: creating missing docs only]' : ''),
    );
    console.log(
      `  ${drinks.size} drinks, ${categories.size} categories, ${presets.size} presets, ` +
        `${recipes.size} recipes, ${sessions.size} sessions, ${orders.size} orders, ` +
        `${staff.length} staff, ${ownSlugs.length} slug(s), ${ownCodes.length} invite code(s)`,
    );
    for (const [oldId, newId] of Object.entries(drinkMap).slice(0, 5)) {
      console.log(`    drinks/${oldId} → ${newId}`);
    }
    const firstSession = sessions.docs[0];
    if (firstSession) console.log(`    sessions/${firstSession.id} → ${sessionMap[firstSession.id]}`);
    if (data.activeSessionId) {
      console.log(`  ! session running (${data.activeSessionId}); orders placed before cutover need step 4`);
    }
  }

  const orphans = userCafes.docs.filter((m) => !owners.has(m.get('cafeId') as string));
  for (const m of orphans) {
    console.warn(`! userCafes/${m.id} points at missing cafe ${m.get('cafeId')}; skipped`);
  }

  await writer.close();
  if (skipped > 0) console.log(`\n${skipped} doc(s) already in locations/; left as they are.`);
  if (failures.length > 0) {
    console.error(`\n${failures.length} write(s) failed:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`\nDone.${commit ? '' : ' (dry run — re-run with --commit to write)'}\n`);
}

/** Delete the old layout. Only after the new app has been deployed and checked. */
async function runCleanup(db: Firestore) {
  console.log('\nCLEANUP — deleting the old layout\n');

  const migrated = await db.collection('_migration').get();
  const done = new Set(migrated.docs.map((d) => d.id));
  const cafes = await db.collection('cafes').get();
  const unmigrated = cafes.docs.filter((c) => !done.has(c.id));
  if (unmigrated.length > 0) {
    console.error(`Not migrated yet: ${unmigrated.map((c) => c.id).join(', ')}. Run --commit first.`);
    process.exit(1);
  }

  for (const cafe of cafes.docs) {
    await db.recursiveDelete(cafe.ref);
    console.log(`  ✓ deleted cafes/${cafe.id}`);
  }
  await db.recursiveDelete(db.collection('userCafes'));
  console.log('  ✓ deleted userCafes');

  const writer = db.bulkWriter();
  for (const name of ['slugs', 'inviteCodes']) {
    const snap = await db.collection(name).get();
    for (const d of snap.docs) {
      if (d.get('locationId')) writer.update(d.ref, { cafeId: FieldValue.delete() });
      else console.warn(`  ! ${name}/${d.id} has no locationId; left alone`);
    }
  }
  await writer.close();
  console.log('  ✓ dropped cafeId from slugs and inviteCodes');
  console.log('\n`_migration` is kept as a record of old → new ids; delete it whenever you like.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
