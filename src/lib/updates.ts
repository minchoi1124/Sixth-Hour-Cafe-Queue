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
    id: '2026-11-19-locations-and-co-owners',
    date: '2026-11-19',
    title: 'More than one location, and co-owners',
    points: [
      'Running Sixth Hour somewhere else too? Go to Settings → Your locations → Add another location. Use the same account for both and switch between them at the top of the screen.',
      'Share a location with another owner: Settings → Owners → Invite a co-owner makes a link. Whoever opens it and signs in becomes an owner too.',
      'Links work once and expire after 7 days. Unused ones can be revoked in Settings.',
      'Any owner can remove another, and you can leave a location yourself, as long as someone is still an owner.',
      'Helpers still just use the staff passcode.',
    ],
  },
  {
    id: '2026-11-18-auto-end-sessions',
    date: '2026-11-18',
    title: 'Forgotten sessions end on their own',
    points: [
      'If a session has no new orders for 3 hours, it ends automatically and the customer screen switches to closed.',
      'Its end time is set to the last order, so History and Stats show when you actually finished. History marks it “Ended automatically”.',
      'Orders still waiting in the queue are left as they are.',
    ],
  },
  {
    id: '2026-11-18-staff-passcode',
    date: '2026-11-18',
    title: 'Staff sign in with a passcode, no account needed',
    points: [
      'Staff now pick their location on the main page and enter its staff passcode. Their phone stays signed in after that.',
      'Every location starts with the passcode 000000. Owners: change it in Settings → Staff passcode as soon as you can, since anyone can guess the default.',
      'Changing the passcode signs out every phone that used the old one.',
      'Staff signed in with the passcode can look it up under Passcode at the top of the screen, to let other helpers in.',
      'To set up the customer iPad, open the main page, pick your location and tap Open customer screen. No passcode needed.',
      'Staff who already have an account keep it, with the same access as the owner. Invite codes are no longer used.',
    ],
  },
  {
    id: '2026-10-25-order-numbers',
    date: '2026-10-25',
    title: 'Order numbers',
    points: [
      'Every order gets a number, starting from #1 each day, shown on its queue card.',
      'Customers see theirs after ordering, so two people with the same name are easy to tell apart.',
    ],
  },
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
