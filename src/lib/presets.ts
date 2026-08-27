/**
 * Named menu presets.
 *
 * The `drinks` collection is a library of every recipe the cafe has created. A
 * preset is a named, ordered subset of it — "Fall Menu", "Finals Week" — that a
 * session snapshots when it starts. Presets are reusable across sessions and are
 * never modified by a session unless someone explicitly saves back to one.
 */
import {
  type Firestore,
  addDoc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { presetDoc, presetsCol } from '@/lib/cafe-paths';
import type { MenuItem, MenuPreset } from '@/lib/definitions';

/**
 * Map an ordered list of drink ids onto library entries.
 *
 * Ids with no matching drink are skipped rather than throwing: deleting a
 * recipe from the library must degrade every preset and past session that
 * referenced it, not break them. Order follows `drinkIds`, not the library.
 */
export function resolveMenu(library: MenuItem[], drinkIds: string[] | undefined): MenuItem[] {
  if (!drinkIds?.length) return [];
  const byId = new Map(library.map((item) => [item.id, item]));
  return drinkIds
    .map((id) => byId.get(id))
    .filter((item): item is MenuItem => item !== undefined);
}

/** Ids in `drinkIds` that no longer exist in the library. */
export function missingDrinkIds(library: MenuItem[], drinkIds: string[] | undefined): string[] {
  if (!drinkIds?.length) return [];
  const known = new Set(library.map((item) => item.id));
  return drinkIds.filter((id) => !known.has(id));
}

export async function createPreset(
  db: Firestore,
  cafeId: string,
  name: string,
  drinkIds: string[],
): Promise<string> {
  const ref = await addDoc(presetsCol(db, cafeId), {
    name: name.trim(),
    drinkIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renamePreset(
  db: Firestore,
  cafeId: string,
  presetId: string,
  name: string,
): Promise<void> {
  await updateDoc(presetDoc(db, cafeId, presetId), {
    name: name.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function updatePresetDrinks(
  db: Firestore,
  cafeId: string,
  presetId: string,
  drinkIds: string[],
): Promise<void> {
  await updateDoc(presetDoc(db, cafeId, presetId), {
    drinkIds,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePreset(
  db: Firestore,
  cafeId: string,
  presetId: string,
): Promise<void> {
  await deleteDoc(presetDoc(db, cafeId, presetId));
}

/**
 * Copy a session's current menu back onto the preset it came from.
 *
 * Deliberately separate from editing the session menu: a one-off tweak during
 * service shouldn't silently change every future session using that preset.
 */
export async function savePresetFromSession(
  db: Firestore,
  cafeId: string,
  presetId: string,
  menuIds: string[],
): Promise<void> {
  await updatePresetDrinks(db, cafeId, presetId, menuIds);
}

/** Sort presets for display: most recently updated first, then by name. */
export function sortPresets(presets: MenuPreset[]): MenuPreset[] {
  return [...presets].sort((a, b) => {
    const at = a.updatedAt?.toMillis?.() ?? 0;
    const bt = b.updatedAt?.toMillis?.() ?? 0;
    if (at !== bt) return bt - at;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Library ordering for browsing: grouped by category, alphabetical within it.
 * Replaces the old global `order` integer, which only ever existed to drive the
 * customer's display order — now handled by position in the session menu.
 */
export function sortLibrary(library: MenuItem[]): MenuItem[] {
  return [...library].sort((a, b) => {
    const cat = (a.category ?? '').localeCompare(b.category ?? '');
    if (cat !== 0) return cat;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });
}
