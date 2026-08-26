'use client';

import { useState } from 'react';
import { orderBy, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { ordersCol } from '@/lib/cafe-paths';
import type { Order, Session } from '@/lib/definitions';
import { recomputeSessionStats, toDate, topDrinks } from '@/lib/sessions';
import { formatSessionDate, formatTimeRange } from '@/lib/timezone';
import OrderHistory from '@/components/staff/OrderHistory';
import { ActivateSessionButton } from '@/components/staff/SessionControls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CalendarClock, Coffee, History, MapPin } from 'lucide-react';

type LiveStats = { drinkCount: number; orderCount: number };

type SessionHistoryProps = {
  cafeId: string;
  timezone: string;
  activeSessionId: string | null;
  /** Live totals for the running session — its stats aren't frozen yet. */
  liveStats: LiveStats;
  /**
   * Newest-first sessions, owned by the staff page so the all-time counter and
   * this list share one listener. `null` while loading.
   */
  sessions: Session[] | null;
};

/** One stat block in a session card. */
function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-3xl font-bold">{value}</span>
      <span className="text-lg text-muted-foreground">{label}</span>
    </div>
  );
}

function SessionCard({
  session,
  timezone,
  isActive,
  liveStats,
  cafeId,
  activeSessionId,
  onOpen,
}: {
  session: Session;
  timezone: string;
  isActive: boolean;
  liveStats: LiveStats;
  cafeId: string;
  activeSessionId: string | null;
  onOpen: () => void;
}) {
  const startsAt = toDate(session.startsAt);
  const endedAt = toDate(session.endedAt);
  const isScheduled = session.status === 'scheduled';

  // A running session's totals are live; an ended one quotes its frozen snapshot.
  const drinkCount = isActive ? liveStats.drinkCount : session.drinkCount ?? 0;
  const top = topDrinks(session.itemCounts, 3);

  return (
    <Card className={isActive ? 'border-primary shadow-lg' : undefined}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-3 text-3xl">
              <MapPin className="h-7 w-7 flex-shrink-0 text-primary/70" />
              {session.location}
            </CardTitle>
            <CardDescription className="mt-1 text-lg">
              {startsAt ? formatSessionDate(startsAt, timezone) : 'Date not available'}
              {startsAt && !isScheduled && ` · ${formatTimeRange(startsAt, endedAt, timezone)}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isActive && <Badge className="text-base">In progress</Badge>}
            {isScheduled && (
              <Badge variant="secondary" className="text-base">
                <CalendarClock className="mr-1 h-4 w-4" />
                Scheduled
              </Badge>
            )}
            {session.backfilled && (
              <Badge variant="outline" className="text-base" title="Reconstructed from order history">
                Backfilled
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isScheduled ? (
          <p className="text-lg text-muted-foreground">
            Not started yet — this session isn&apos;t collecting orders.
          </p>
        ) : (
          <Stat
            icon={<Coffee className="h-7 w-7 text-muted-foreground" />}
            value={drinkCount}
            label={drinkCount === 1 ? 'drink' : 'drinks'}
          />
        )}

        {top.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {top.map((drink) => (
              <Badge key={drink.name} variant="secondary" className="text-base">
                {drink.name} × {drink.count}
              </Badge>
            ))}
          </div>
        )}

        {session.notes && <p className="text-lg text-muted-foreground">{session.notes}</p>}

        <div className="flex flex-wrap gap-2">
          {isScheduled ? (
            <ActivateSessionButton
              cafeId={cafeId}
              session={session}
              disabled={!!activeSessionId}
            />
          ) : (
            <Button variant="outline" onClick={onOpen} className="text-lg">
              View orders
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** The completed orders inside one session. */
function SessionDetail({
  cafeId,
  session,
  timezone,
  isActive,
  onBack,
}: {
  cafeId: string;
  session: Session;
  timezone: string;
  isActive: boolean;
  onBack: () => void;
}) {
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return query(
      ordersCol(firestore, cafeId),
      where('sessionId', '==', session.id),
      where('status', '==', 'completed'),
      orderBy('createdAt', 'desc'),
    );
  }, [firestore, cafeId, session.id]);

  const { data: orders } = useCollection<Order>(ordersQuery);
  const startsAt = toDate(session.startsAt);

  // An ended session quotes frozen numbers, so deleting an order from it has to
  // re-freeze them. A running session recomputes from its live query anyway.
  const handleOrderDeleted = () => {
    if (!firestore || isActive) return;
    recomputeSessionStats(firestore, cafeId, session.id).catch((e) =>
      console.error('Failed to recompute session stats:', e),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button variant="ghost" onClick={onBack} className="mb-2 -ml-2 text-lg">
            <ArrowLeft className="mr-2 h-5 w-5" />
            All sessions
          </Button>
          <h2 className="text-4xl font-bold">{session.location}</h2>
          <p className="text-xl text-muted-foreground">
            {startsAt ? formatSessionDate(startsAt, timezone) : 'Date not available'}
            {startsAt && ` · ${formatTimeRange(startsAt, toDate(session.endedAt), timezone)}`}
          </p>
        </div>
      </div>

      <OrderHistory orders={orders ?? []} onOrderDeleted={handleOrderDeleted} />
    </div>
  );
}

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card px-4 py-24 text-center">
    <History className="mb-6 h-24 w-24 text-muted-foreground/50" />
    <h2 className="text-4xl font-bold">No Sessions Yet</h2>
    <p className="mt-2 text-2xl text-muted-foreground">
      Start a session to begin tracking drinks.
    </p>
  </div>
);

/**
 * History is now a list of sessions with their totals, drillable to the orders
 * inside one. Ended sessions read only their own doc — no scan of every order.
 */
export default function SessionHistory({
  cafeId,
  timezone,
  activeSessionId,
  liveStats,
  sessions,
}: SessionHistoryProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (sessions === null) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) return <EmptyState />;

  // Sessions arrive newest-first by start time, which would sort a session
  // planned for next week above the one running right now. Pin the active one.
  const ordered = [...sessions].sort((a, b) => {
    if (a.id === activeSessionId) return -1;
    if (b.id === activeSessionId) return 1;
    return 0;
  });

  const selected = selectedId ? sessions.find((s) => s.id === selectedId) : null;
  if (selected) {
    return (
      <SessionDetail
        cafeId={cafeId}
        session={selected}
        timezone={timezone}
        isActive={selected.id === activeSessionId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {ordered.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          timezone={timezone}
          isActive={session.id === activeSessionId}
          liveStats={liveStats}
          cafeId={cafeId}
          activeSessionId={activeSessionId}
          onOpen={() => setSelectedId(session.id)}
        />
      ))}
    </div>
  );
}
