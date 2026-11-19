/** `slug` is the public ordering link, /order/{slug}. */
export type LocationChoice = { id: string; name: string; slug: string | null };

/** The query that shows a hidden test location in the picker: /?location={slug}. */
export const REVEAL_PARAM = 'location';

/**
 * The locations the main page's picker offers, by name. Test locations
 * (`hidden`, src/lib/test-locations.ts) are left out unless the page was opened
 * with that location's own link, /?location={slug}. Hidden is not secret:
 * location docs are world-readable. It keeps test data out of everyone's way.
 */
export function pickerLocations(
  all: (LocationChoice & { hidden: boolean })[],
  reveal?: string | null,
): LocationChoice[] {
  return all
    .filter((location) => !location.hidden || (reveal != null && location.slug === reveal))
    .map(({ id, name, slug }) => ({ id, name, slug }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
