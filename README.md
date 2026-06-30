# Sixth Hour Cafe Queue

**Live demo: [sixth-hour-cafe-queue.vercel.app](https://sixth-hour-cafe-queue.vercel.app)**

A real-time cafe order management system built with Next.js and Firebase — designed for a two-screen workflow where customers place orders on one iPad and staff manage the live queue on another.

Originally built for **Sixth Hour Cafe**, an Anchor Christian Fellowship at MSU pop-up cafe. This project was developed end-to-end as a personal project to solve a real operational problem: tracking handwritten drink orders is error-prone and slows down service during busy rushes.

---

## What it does

It's **multi-tenant**: every cafe is a **Sixth Hour Cafe**, and each account is a different **location** (and the people running it) that the brand owner lets onboard their own isolated queue. The intended setup is a **two-screen kiosk** — a customer-facing tablet running the order page, and a staff tablet running the live queue — though the customer page can also be shared as a link or QR.

**Landing (`/`)** — Product intro with links to sign up / log in.

**Sign in (`/login`)** — Operators create an account or sign in with email/password or Google. New operators complete a quick setup (`/onboarding`) naming their location and choosing a unique public link slug.

**Customer screen (`/order/[slug]`)** — A cafe's public order page, typically opened on a customer-facing tablet (or reached via a shared link/QR). Customers tap their name, select drinks and modifications, and submit. No login required. The order appears on that cafe's staff screen in real time.

**Staff queue (`/staff`)** — The signed-in owner or staff member sees that location's pending orders as cards, with animated transitions when orders arrive or are completed. Each card can be marked done or deleted (with a one-tap **Undo**). Completed orders move to an archived history. A "Customer screen" button copies the order-page URL to open on the customer-facing device.

**Menu management (`/staff/menu`)** — Owners and staff add/remove drinks, update descriptions, mark items out-of-stock, reorder items, and manage categories and modifiers — all scoped to their own cafe, with auto-save and real-time sync.

**Settings (`/staff/settings`, owner-only)** — Rename the location, change the customer link, toggle and configure an Instagram QR shown after ordering, and manage staff.

**Staff invites** — From Settings, an owner generates an invite code/link. Anyone who signs up and redeems it at `/join` becomes staff for that location, with access to the **queue and menu** (location settings, link, Instagram, and staff management stay owner-only).

---

## Technical highlights

- **Multi-tenant data isolation** — Every location's data lives under `cafes/{cafeId}/…` where `cafeId` is the owner's Auth uid. Firestore Security Rules scope all access to a single cafe, while menus stay publicly readable for customers.
- **Role-based staff access** — A user is resolved as **owner** (`cafes/{uid}`) or **staff** (a `userCafes/{uid}` membership created by redeeming an invite code). Owners and staff share queue + menu access; settings and the staff roster are owner-only — all enforced in the rules.
- **Real-time sync** — Firestore `onSnapshot` listeners push order and menu updates to every connected screen instantly, with no polling.
- **Optimistic UI** — Menu changes reflect in the UI immediately and save to Firestore in the background, with a visible auto-save status indicator.
- **Reversible deletes** — Deleting a queued order is a soft delete (`status: 'cancelled'`) with an Undo toast; a daily Vercel Cron job purges cancelled orders older than a week.
- **Server-side order creation** — Customers place orders through a Next.js API route (`/api/orders`) that writes via the Firebase Admin SDK. Security Rules deny client-side order creates entirely, so the route is the only path in. This keeps the customer screen login-free and lets App Check stay off Firestore reads so real-time updates stay instant.
- **Abuse protection** — The order route verifies a Firebase App Check (reCAPTCHA v3) token before writing — validated directly with `jose` to avoid the firebase-admin app-check ESM/serverless issue — and validates the order's shape and size.
- **Public reads via Admin SDK** — Server components resolve slug → cafe and load the initial menu with the Admin SDK, so public pages render without exposing client credentials or depending on App Check.
- **Per-cafe Instagram QR** — Owners can attach an Instagram link; the order-confirmation screen generates a QR for it on the fly (`qrcode.react`), toggleable per location.
- **Environment-variable-validated config** — Firebase credentials are validated at startup so misconfigured deployments fail fast with a clear error rather than silently at runtime.
- **Animated order cards** — Framer Motion drives entrance, exit, and state-transition animations on order cards for a polished staff-facing UX.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| Server | Next.js API routes + Firebase Admin SDK (order writes, public reads, cleanup) |
| Abuse protection | Firebase App Check (reCAPTCHA v3), verified with `jose` |
| Scheduling | Vercel Cron (daily cleanup) |
| QR codes | qrcode.react |
| Styling | Tailwind CSS + Radix UI primitives |
| Animation | Framer Motion |
| Forms | React Hook Form + Zod |
| Deployment | Vercel + Firebase App Hosting |

---

## Project structure

```
src/
  app/
    /                  — Landing page
    /login             — Sign in / sign up (email + Google)
    /onboarding        — First-time setup (location name + public slug)
    /join              — Redeem an invite code to join a location as staff
    /order/[slug]      — Public customer ordering screen (per cafe)
    /api/orders        — Server route: verifies App Check + writes orders (Admin SDK)
    /api/cron/cleanup  — Scheduled purge of old cancelled orders (Admin SDK)
    /staff             — Queue dashboard (auth-gated; owner or staff)
    /staff/menu        — Menu and category management
    /staff/settings    — Location, link, Instagram, and staff management (owner-only)
  components/          — UI components for customer and staff flows
  lib/
    data.ts            — Server-side public reads (slug → cafe, menu) via Admin SDK
    firebase-admin.ts  — Lazy Firebase Admin SDK init (server-only)
    cafe-paths.ts      — Cafe-scoped Firestore path helpers + slug/invite utilities
    definitions.ts     — Shared TypeScript types
  firebase/            — Client init, App Check, auth + cafe-membership providers
scripts/
  migrate.ts           — One-time legacy → multi-tenant data migration (Admin SDK)
vercel.json            — Vercel Cron schedule for the cleanup job
```

---

## Local setup

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore and Authentication enabled

### Install

```bash
npm install
```

### Configure environment

```bash
cp .env.example .env.local
# Fill in your Firebase project credentials
```

### Run

```bash
npm run dev        # Starts at http://localhost:9002
npm run build      # Production build
npm run typecheck  # Type check without emitting
```

---

## Firestore data model

Each location owns an isolated subtree under `cafes/{cafeId}`, where `cafeId === the operator's Auth uid`. The `location` field is the branch label (e.g. "MSU Campus"); the brand ("Sixth Hour Cafe") is fixed in the UI. A top-level `slugs` collection maps public slugs to locations for customer links.

| Path | Fields |
|---|---|
| `cafes/{cafeId}` | `location`, `slug`, `createdAt`, `instagramEnabled?`, `instagramUrl?` |
| `cafes/{cafeId}/orders/{id}` | `customerName`, `items[]`, `status` (`pending` / `completed` / `archived` / `cancelled`), `createdAt` |
| `cafes/{cafeId}/drinks/{id}` | `name`, `description`, `category`, `inStock`, `order`, `modifications[]` |
| `cafes/{cafeId}/categories/{id}` | `name` |
| `cafes/{cafeId}/counters/{id}` | all-time drink totals |
| `cafes/{cafeId}/private/invite` | `code` (owner-only; current invite code) |
| `slugs/{slug}` | `cafeId` |
| `inviteCodes/{code}` | `cafeId` (staff join lookup) |
| `userCafes/{uid}` | `cafeId`, `role`, `email`, `code` (staff membership) |

Access is enforced by [`firestore.rules`](firestore.rules): cafe info, menus and categories are publicly readable; client-side order **creates are denied** — orders are written only by the `/api/orders` server route (Admin SDK). Owners (`request.auth.uid == cafeId`) and **staff** (a `userCafes/{uid}` doc pointing at the cafe) may manage drinks, categories, and orders; cafe settings, invite codes, and the staff roster are **owner-only**.

---

## Deployment

The app is deployed on Vercel with Firebase as the backend. To deploy your own instance:

1. Create a Firebase project and enable Firestore + Authentication.
2. In **Authentication → Sign-in method**, enable **Email/Password** and **Google**, and add your domain under **Authorized domains**.
3. Deploy the security rules and indexes:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
4. Generate a service account key (**Project Settings → Service accounts → Generate new private key**) and set it as `FIREBASE_SERVICE_ACCOUNT` (the full JSON on one line). This powers the server-side reads and the order API route.
5. (Recommended) Enable **App Check** with reCAPTCHA v3 and set `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`. Leave Firestore enforcement **off (monitoring)** — the order route verifies App Check itself, and unenforced reads keep real-time listeners instant.
6. Add the variables from `.env.example` to your Vercel project settings (for **all** environments you deploy, including Preview). Set `CRON_SECRET` to any random string so the cleanup cron is authenticated.
7. Push the repo — Vercel builds and deploys automatically.

A **Vercel Cron** job (see [`vercel.json`](vercel.json)) calls `/api/cron/cleanup` daily to purge soft-deleted (`cancelled`) orders older than a week.

### Migrating existing single-cafe data

If you're upgrading from the original single-cafe version, run the one-time migration to move legacy top-level collections into your new account. See the instructions in [`scripts/migrate.ts`](scripts/migrate.ts).

---

## Background

This project started as a practical tool for a real cafe and grew into a full-stack exercise in building a production-quality real-time web app from scratch — including data modeling, UI/UX decisions for touch screens, deployment configuration, and iterative feature development based on actual use.
