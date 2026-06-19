# Sixth Hour Cafe Queue

**Live demo: [sixth-hour-cafe-queue.vercel.app](https://sixth-hour-cafe-queue.vercel.app)**

A real-time cafe order management system built with Next.js and Firebase — designed for a two-screen workflow where customers place orders on one iPad and staff manage the live queue on another.

![Demo: customer places an order, staff queue updates instantly](docs/screenshots/demo.gif)

Originally built for **Sixth Hour Cafe**, an Anchor Christian Fellowship at MSU pop-up cafe. This project was developed end-to-end as a personal project to solve a real operational problem: tracking handwritten drink orders is error-prone and slows down service during busy rushes.

---

## What it does

**Customer screen (`/`)** — Customers tap their name, select one or more drinks, choose any modifications, and submit. The order appears on the staff screen in real time.

**Staff queue (`/staff`)** — Staff see all pending orders as cards, with animated transitions when orders arrive or are completed. Completed orders move to an archived history.

**Menu management (`/staff/menu`)** — Staff can add/remove drinks, update descriptions and pricing, mark items out-of-stock, reorder categories, and manage drink modifiers — all with auto-save and real-time sync.

---

## Technical highlights

- **Real-time sync** — Firestore `onSnapshot` listeners push order and menu updates to every connected screen instantly, with no polling.
- **Optimistic UI** — Menu changes reflect in the UI immediately and save to Firestore in the background, with a visible auto-save status indicator.
- **Type-safe data layer** — All Firestore reads and writes go through typed helpers in `src/lib/data.ts`, keeping components decoupled from the database shape.
- **Server actions** — Order submission uses Next.js Server Actions to keep mutation logic off the client bundle.
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
| Styling | Tailwind CSS + Radix UI primitives |
| Animation | Framer Motion |
| Forms | React Hook Form + Zod |
| Deployment | Vercel + Firebase App Hosting |

---

## Project structure

```
src/
  app/
    /               — Customer ordering screen
    /staff          — Staff queue dashboard
    /staff/menu     — Menu and category management
  components/       — UI components for customer and staff flows
  lib/
    data.ts         — Firestore read/write helpers
    actions.ts      — Next.js Server Actions for order mutation
    types.ts        — Shared TypeScript types
  firebase/         — Firebase initialization and React context provider
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
npm run lint       # ESLint
```

---

## Firestore data model

| Collection | Fields |
|---|---|
| `orders` | `customerName`, `items[]`, `status` (`pending` / `completed` / `archived`), `createdAt` |
| `drinks` | `name`, `description`, `category`, `inStock`, `displayOrder`, `modifiers[]` |
| `categories` | `name`, `displayOrder`, `iconName` |

---

## Deployment

The app is deployed on Vercel with Firebase as the backend. To deploy your own instance:

1. Create a Firebase project and enable Firestore + Authentication.
2. Add the variables from `.env.example` to your Vercel project settings.
3. Push the repo — Vercel builds and deploys automatically.

For production, review and tighten the Firestore security rules in [`firestore.rules`](firestore.rules) before going live.

---

## Background

This project started as a practical tool for a real cafe and grew into a full-stack exercise in building a production-quality real-time web app from scratch — including data modeling, UI/UX decisions for touch screens, deployment configuration, and iterative feature development based on actual use.
