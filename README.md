# Sixth Hour Cafe Queue

Sixth Hour Cafe Queue is a Next.js + Firebase web app for managing cafe drink orders from a customer-facing screen and a staff dashboard. Customers can place orders for available drinks, and staff can view the queue, mark orders complete, archive history, and manage the menu.

## What this app does

- Lets customers select a drink, enter their name, and optionally choose custom modifications.
- Shows the current pending order queue for staff.
- Lets staff mark orders as complete and review history.
- Supports menu and category management so staff can update drink availability, descriptions, ordering, and modifiers.
- Uses real-time Firebase Firestore updates so the queue stays current.

## Tech stack

- Next.js 15
- React 18
- TypeScript
- Firebase (Firestore + Authentication)
- Tailwind CSS + shadcn-style UI components
- Genkit (for AI-related setup hooks)

## Project layout

- [src/app](src/app) — route-level pages and layouts
  - `/` — customer ordering screen
  - `/staff` — staff queue dashboard
  - `/staff/menu` — menu/category management
- [src/components](src/components) — UI components for customer and staff flows
- [src/lib](src/lib) — shared types, server actions, and data access helpers
- [src/firebase](src/firebase) — Firebase initialization and provider logic
- [docs](docs) — project planning notes and blueprint documentation

## Core data model

The app works with three main collections in Firestore:

- `drinks` — menu items, descriptions, stock status, category, display order, and modifiers
- `orders` — customer orders with name, selected items, timestamps, and status (`pending`, `completed`, `archived`)
- `categories` — drink categories used to group menu items

## Local setup

### Prerequisites

- Node.js 18 or newer
- npm
- A Firebase project (for Firestore and App Hosting support)

### Install dependencies

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

The app will start at the configured local port (default: 9002 in this repo).

### Useful scripts

```bash
npm run build
npm run start
npm run typecheck
npm run lint
```

## Firebase notes

The app initializes Firebase in a way that supports both local development and Firebase App Hosting. The client provider handles anonymous sign-in so the app can use Firestore once the browser loads.

The Firestore rules in [firestore.rules](firestore.rules) are currently permissive for development/demo use. For production, review and tighten these rules before deployment.

## Running the staff tools

- Visit `/staff` to manage the live queue and completed order history.
- Visit `/staff/menu` to edit drink details, stock availability, menu order, and categories.

## Notes for contributors

- UI styling is designed for a clean, large-screen cafe workflow.
- Order cards use real-time updates and animated transitions.
- Most business logic for order and menu updates lives in [src/lib/data.ts](src/lib/data.ts) and [src/lib/actions.ts](src/lib/actions.ts).
