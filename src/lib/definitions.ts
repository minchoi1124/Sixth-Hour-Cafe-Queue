import { FieldValue, Timestamp } from "firebase/firestore";

export type Modification = {
  id: string;
  name: string;
  default: boolean;
};

/**
 * A drink recipe in the cafe's library. The library holds everything ever
 * created; what customers see is the active session's menu, not this list.
 */
export type MenuItem = {
  id: string; // Firestore document ID
  name: string;
  description: string;
  /**
   * Legacy. Availability is now per-session (`Session.soldOutIds`) so running
   * out one week doesn't carry into the next. Kept so old docs still parse.
   */
  inStock: boolean;
  category: string;
  /**
   * Legacy. Display order now comes from position in the session's `menuIds`,
   * so this no longer drives what customers see. The library sorts by category
   * and name.
   */
  order: number;
  modifications: Modification[];
};

/**
 * A named, reusable menu — "Fall Menu", "Finals Week". Starting a session
 * snapshots one of these onto the session; the preset itself is never changed
 * by that session unless someone explicitly saves back to it.
 */
export type MenuPreset = {
  id: string; // Firestore document ID
  name: string;
  /** Ordered: array position is the display order customers see. */
  drinkIds: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type OrderItem = {
    id: string; // ID of the base menu item
    name: string;
    modifications: string[]; // Names of selected modifications
}

export type Order = {
  id: string; // Firestore document ID
  customerName: string;
  items: OrderItem[];
  createdAt: string; // ISO string for client
  // 'archived' is legacy: it used to mean "hidden by Clear History". Sessions
  // replaced that, and the backfill collapsed archived orders into 'completed'.
  // Nothing writes it any more; it stays in the union so old docs still parse.
  status: 'pending' | 'completed' | 'archived' | 'cancelled';
  /**
   * The session this order belongs to, or null if it was placed while no session
   * was running. Always written explicitly — Firestore cannot match
   * `where('sessionId', '==', null)` against documents missing the field, and
   * orphan adoption depends on that query.
   */
  sessionId: string | null;
};

export type NewOrder = {
  customerName: string;
  items: OrderItem[];
}

export type FirestoreOrder = Omit<Order, 'id' | 'createdAt'> & {
  createdAt: FieldValue;
};

/**
 * A session is one pop-up service: staff start it, make drinks, then end it.
 * Ending freezes the stats onto the doc so history never has to re-read orders.
 */
export type SessionStatus = 'scheduled' | 'active' | 'ended';

export type Session = {
  id: string; // Firestore document ID
  /** Venue for this specific session, e.g. "Library 2nd floor". */
  location: string;
  /** Autofilled to "now" but editable, so a session can be planned ahead. */
  startsAt: Timestamp;
  endedAt?: Timestamp | null;
  status: SessionStatus;
  notes?: string;
  /**
   * The ordered menu for this session, snapshotted from a preset when the
   * session is created. Authoritative and historical — editing the preset later
   * must not change what a past session served.
   */
  menuIds: string[];
  /**
   * Drinks that ran out during this session. Session-scoped by construction, so
   * there's no reset step to forget between services.
   */
  soldOutIds: string[];
  /** Which preset the menu came from, for the deliberate "save back" action. */
  presetId?: string | null;
  // --- Stats snapshot, written when the session ends (or on recompute) ---
  drinkCount?: number;
  orderCount?: number;
  /** Drink name -> quantity made. */
  itemCounts?: Record<string, number>;
  statsUpdatedAt?: Timestamp;
  /** True for sessions reconstructed from pre-sessions order history. */
  backfilled?: boolean;
};

/** The fields the start-session dialog collects. */
export type NewSession = {
  location: string;
  startsAt: Date;
  notes?: string;
  /** Required: a session with no menu leaves customers nothing to order. */
  menuIds: string[];
  presetId?: string | null;
};

/**
 * What customers are being served right now, mirrored onto the cafe document.
 *
 * Sessions are staff-only, but the cafe doc is world-readable and already
 * fetched when resolving a slug — so this gives the unauthenticated ordering
 * page the live menu and sold-out state with no extra read and nothing internal
 * exposed. `null` means the cafe is closed.
 */
export type LiveMenu = {
  drinkIds: string[];
  soldOutIds: string[];
};

export type Category = {
    id: string;
    name: string;
}

// Every cafe is a Sixth Hour Cafe; `location` is the branch/operator label
// (e.g. "MSU Campus") that distinguishes one account from another.
export type Cafe = {
  id: string; // == owner uid == cafeId
  location: string;
  slug: string;
  createdAt?: string;
  /** Instagram URL shown as a QR on the order-confirmation screen. */
  instagramUrl?: string;
  /** Whether to show the Instagram QR to customers. */
  instagramEnabled?: boolean;
  /**
   * The session currently running, or null/absent when none is. Single source of
   * truth for which session a new order belongs to; the order API reads it off
   * the same cafe snapshot it already fetches.
   */
  activeSessionId?: string | null;
  /** IANA timezone used to group sessions by date. Defaults to America/New_York. */
  timezone?: string;
  /** Public mirror of the active session's menu; null/absent means closed. */
  liveMenu?: LiveMenu | null;
};
