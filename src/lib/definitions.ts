import { FieldValue, Timestamp } from "firebase/firestore";

export type Modification = {
  id: string;
  name: string;
  default: boolean;
};

export type MenuItem = {
  id: string; // Firestore document ID
  name: string;
  description: string;
  inStock: boolean;
  category: string;
  order: number;
  modifications: Modification[];
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
};
