/**
 * "What's new" notes shown to staff, newest first. Add an entry in the same
 * change that ships the feature, so the note goes live with it.
 *
 * Each account stores the newest id it has seen at
 * `users/{uid}.lastSeenUpdate`; anything above that in this list is unread.
 * Ids are date-prefixed so they read well in the Firebase console, and must
 * never change once shipped.
 */
export type Update = {
  id: string;
  date: string;
  title: string;
  points: string[];
};

export const UPDATES: Update[] = [
  {
    id: '2026-10-25-order-chime',
    date: '2026-10-25',
    title: 'Hear new orders come in',
    points: [
      'Tap the bell next to the drink counter on the Queue page to play a chime for each new order.',
      'Each iPad remembers its own setting. If the bell was left on, tap anywhere on the page once after opening it to let sound play.',
    ],
  },
  {
    id: '2026-10-25-customer-qr',
    date: '2026-10-25',
    title: 'Open the customer screen with a QR code',
    points: [
      'Tap "Customer screen" in the top bar and scan the code with the customer-facing iPad.',
      'The link is written under the code for devices without a camera.',
    ],
  },
];

export const LATEST_UPDATE_ID = UPDATES[0]?.id ?? '';

/**
 * Updates newer than `lastSeen`. An account that has never dismissed the
 * dialog sees everything; an id no longer in the list counts as all seen.
 */
export function unseenUpdates(lastSeen: string | undefined): Update[] {
  if (!lastSeen) return UPDATES;
  const index = UPDATES.findIndex((update) => update.id === lastSeen);
  return index === -1 ? [] : UPDATES.slice(0, index);
}
