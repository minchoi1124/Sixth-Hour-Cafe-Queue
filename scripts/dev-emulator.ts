/**
 * Local preview against the Firebase emulators: seeds test data, then runs
 * `next dev` pointed at them. Nothing touches the real Firebase project.
 *
 *   npm run dev:emulator      → http://localhost:9002
 *
 * Run through `firebase emulators:exec` (see package.json), which starts the
 * Auth and Firestore emulators with this repo's firestore.rules and sets
 * FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST for this process and
 * the dev server. Data is wiped when you stop it.
 *
 * Seeded:
 *   - "MSU Campus" (link /order/msu) with a few drinks, no passcode saved (so 000000)
 *   - "Downtown"  (link /order/downtown), so the picker has a choice
 *   - owner login for MSU Campus: owner@example.com / password123
 *   - an account from the old invite system: staff@example.com / password123
 *   - a forgotten session at MSU Campus, idle for 4 hours (see below)
 */
import { spawn } from 'node:child_process';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const PROJECT_ID = 'demo-sixth-hour';

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('Run this with `npm run dev:emulator`, which starts the emulators first.');
  process.exit(1);
}

// Client config for the emulators. A `demo-` project needs no real keys.
const env: Record<string, string> = {
  NEXT_PUBLIC_USE_EMULATORS: 'true',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT_ID}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: 'demo-app',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '0',
  // Never let a real key from .env.local switch App Check on locally.
  NEXT_PUBLIC_RECAPTCHA_SITE_KEY: '',
  FIREBASE_SERVICE_ACCOUNT: '',
};

async function seed() {
  initializeApp({ projectId: PROJECT_ID });
  const db = getFirestore();
  const auth = getAuth();

  const owner = await auth.createUser({ uid: 'owner-uid', email: 'owner@example.com', password: 'password123' });
  const oldStaff = await auth.createUser({ uid: 'staff-uid', email: 'staff@example.com', password: 'password123' });

  const loc = db.doc('locations/msu-campus');
  const batch = db.batch();
  batch.set(loc, { location: 'MSU Campus', slug: 'msu', timezone: 'America/New_York', createdAt: FieldValue.serverTimestamp() });
  batch.set(db.doc('slugs/msu'), { locationId: 'msu-campus' });
  batch.set(loc.collection('members').doc(owner.uid), { email: owner.email, role: 'owner', joinedAt: FieldValue.serverTimestamp() });
  batch.set(db.doc(`users/${owner.uid}`), { locationId: 'msu-campus', role: 'owner', email: owner.email });
  // Left over from invites: should get no access under the new rules.
  batch.set(loc.collection('members').doc(oldStaff.uid), { email: oldStaff.email, role: 'staff', code: 'K7Q2PX9R' });
  batch.set(db.doc(`users/${oldStaff.uid}`), { locationId: 'msu-campus', role: 'staff', email: oldStaff.email });

  batch.set(loc.collection('categories').doc('coffee'), { name: 'Coffee' });
  batch.set(loc.collection('categories').doc('tea'), { name: 'Tea' });
  const drinks = [
    { id: 'matcha-latte', name: 'Matcha Latte', category: 'Tea', description: 'Ceremonial matcha with oat milk.' },
    { id: 'london-fog', name: 'London Fog', category: 'Tea', description: 'Earl grey, vanilla and steamed milk.' },
    { id: 'iced-latte', name: 'Iced Latte', category: 'Coffee', description: 'Espresso over ice and milk.' },
  ];
  drinks.forEach((drink, order) => {
    const { id, ...rest } = drink;
    batch.set(loc.collection('drinks').doc(id), { ...rest, inStock: true, order, modifications: [] });
  });

  // A session someone forgot to end: started 5 hours ago, last order 4 hours
  // ago. Placing an order on /order/msu ends it automatically, back-dated to
  // that last order (src/lib/auto-end-session.ts).
  const HOUR = 60 * 60 * 1000;
  const hoursAgo = (h: number) => Timestamp.fromDate(new Date(Date.now() - h * HOUR));
  const sessionId = `${new Date().toISOString().slice(0, 10)}_library_demo`;
  const menuIds = drinks.map((drink) => drink.id);
  batch.set(loc.collection('sessions').doc(sessionId), {
    location: 'Library',
    startsAt: hoursAgo(5),
    endedAt: null,
    status: 'active',
    menuIds,
    soldOutIds: [],
    lastOrderAt: hoursAgo(4),
  });
  batch.update(loc, { activeSessionId: sessionId, liveMenu: { drinkIds: menuIds, soldOutIds: [] } });
  [
    { id: 'demo-1', name: 'Sam', drink: 'Matcha Latte', at: 4.5, status: 'completed', number: 1 },
    { id: 'demo-2', name: 'Alex', drink: 'Iced Latte', at: 4, status: 'completed', number: 2 },
  ].forEach((order) => {
    batch.set(loc.collection('orders').doc(order.id), {
      customerName: order.name,
      items: [{ id: order.drink, name: order.drink, modifications: [] }],
      status: order.status,
      sessionId,
      number: order.number,
      createdAt: hoursAgo(order.at),
    });
  });

  const downtown = db.doc('locations/downtown');
  batch.set(downtown, { location: 'Downtown', slug: 'downtown', timezone: 'America/New_York', createdAt: FieldValue.serverTimestamp() });
  batch.set(db.doc('slugs/downtown'), { locationId: 'downtown' });
  await batch.commit();
}

async function main() {
  await seed();
  console.log(`
  ┌─────────────────────────────────────────────────────────────┐
  │  Local preview (emulators, test data only)                  │
  │                                                             │
  │  App:          http://localhost:9002                        │
  │  Staff:        MSU Campus, passcode 000000                  │
  │  Owner login:  owner@example.com / password123              │
  │  Old staff:    staff@example.com / password123 (role staff) │
  │  Forgotten session at MSU: order on /order/msu to end it    │
  └─────────────────────────────────────────────────────────────┘
`);

  const child = spawn('npx', ['next', 'dev', '--turbopack', '-p', '9002'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  });
  const stop = () => child.kill();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
