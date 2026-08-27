'use client';

import { useEffect, useMemo, useState } from 'react';
import { getDocs, orderBy, query } from 'firebase/firestore';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useCafeId } from '@/firebase';
import { cafeDoc, ordersCol, sessionsCol } from '@/lib/cafe-paths';
import type { Cafe, Order, Session } from '@/lib/definitions';
import {
  drinkLeaderboard,
  groupOrdersBySession,
  isCounted,
  sessionSeries,
  throughput,
} from '@/lib/stats';
import { cafeTimezone } from '@/lib/timezone';
import { DrinksPerSessionChart } from '@/components/staff/stats/DrinksPerSessionChart';
import { DrinkLeaderboard } from '@/components/staff/stats/DrinkLeaderboard';
import { ThroughputTable } from '@/components/staff/stats/ThroughputTable';
import { RushCurve } from '@/components/staff/stats/RushCurve';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Coffee } from 'lucide-react';

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-lg text-muted-foreground">{label}</p>
        <p className="mt-1 text-5xl font-bold text-primary">{value}</p>
        {hint && <p className="mt-1 text-base text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function StatsPageClient() {
  const firestore = useFirestore();
  const cafeId = useCafeId();

  const cafeRef = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return cafeDoc(firestore, cafeId);
  }, [firestore, cafeId]);
  const { data: cafe } = useDoc<Cafe>(cafeRef);
  const timezone = cafeTimezone(cafe?.timezone);

  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return query(sessionsCol(firestore, cafeId), orderBy('startsAt', 'desc'));
  }, [firestore, cafeId]);
  const { data: sessions, isLoading: isLoadingSessions } = useCollection<Session>(sessionsQuery);

  // Orders are fetched once with getDocs rather than subscribed to.
  //
  // Totals could come from the frozen session stats alone, but timing can't:
  // most sessions are backfilled, so their start/end times were reconstructed
  // rather than recorded, and only the orders carry genuine timestamps. A live
  // listener over every order is what the all-time counter was deliberately
  // moved away from — a one-shot read on a page nobody watches during service
  // costs the same reads once, and never grows a subscription.
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  useEffect(() => {
    if (!firestore || !cafeId) return;
    let cancelled = false;

    (async () => {
      try {
        const snapshot = await getDocs(ordersCol(firestore, cafeId));
        if (cancelled) return;
        setOrders(
          snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              // Firestore Timestamp -> ISO, matching the shape the rest of the
              // app passes around as `Order.createdAt`.
              createdAt: data.createdAt?.toDate?.()?.toISOString() ?? '',
            } as Order;
          }),
        );
      } catch (e) {
        if (cancelled) return;
        console.error('Failed to load orders for stats:', e);
        setOrdersError(e instanceof Error ? e.message : 'Could not load order history.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [firestore, cafeId]);

  const formatLabel = useMemo(
    () => (date: Date) =>
      date.toLocaleDateString('en-US', { timeZone: timezone, month: 'short', day: 'numeric' }),
    [timezone],
  );
  const formatTime = useMemo(
    () => (date: Date) =>
      date.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
      }),
    [timezone],
  );

  const endedSessions = useMemo(
    () => (sessions ?? []).filter((s) => s.status === 'ended'),
    [sessions],
  );
  const series = useMemo(
    () => sessionSeries(sessions ?? [], formatLabel),
    [sessions, formatLabel],
  );
  const leaderboard = useMemo(() => drinkLeaderboard(sessions ?? []), [sessions]);
  const ordersBySession = useMemo(() => groupOrdersBySession(orders ?? []), [orders]);
  const rates = useMemo(
    () => throughput(sessions ?? [], ordersBySession, formatLabel),
    [sessions, ordersBySession, formatLabel],
  );

  const totalDrinks = leaderboard.reduce((n, d) => n + d.drinks, 0);
  const bestRate = rates.find((r) => r.reliable) ?? null;
  const busiest = [...series].sort((a, b) => b.drinks - a.drinks)[0] ?? null;
  const cancelled = (orders ?? []).filter((o) => !isCounted(o)).length;

  if (isLoadingSessions) {
    return (
      <div className="container mx-auto space-y-8 p-4 sm:p-8">
        <Skeleton className="h-14 w-1/2" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (endedSessions.length === 0) {
    return (
      <div className="container mx-auto p-4 sm:p-8">
        <h1 className="text-5xl font-bold">Stats</h1>
        <Card className="mt-8">
          <CardContent className="py-16 text-center">
            <Coffee className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
            <p className="text-2xl font-medium">No finished sessions yet</p>
            <p className="mt-2 text-xl text-muted-foreground">
              Stats appear once you&apos;ve run and ended a session.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-8 p-4 sm:p-8">
      <div>
        <h1 className="text-5xl font-bold">Stats</h1>
        <p className="text-2xl text-muted-foreground">
          {endedSessions.length} finished session{endedSessions.length === 1 ? '' : 's'}
          {cancelled > 0 && ` · ${cancelled} cancelled order${cancelled === 1 ? '' : 's'} excluded`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Drinks all time" value={totalDrinks.toLocaleString()} />
        <StatCard
          label="Busiest session"
          value={busiest ? String(busiest.drinks) : '—'}
          hint={busiest ? `${busiest.label} · ${busiest.location}` : undefined}
        />
        <StatCard
          label="Fastest service"
          value={bestRate?.perHour ? `${bestRate.perHour.toFixed(0)}/hr` : '—'}
          hint={bestRate ? `${bestRate.label} · ${bestRate.location}` : 'Needs a longer session'}
        />
      </div>

      {ordersError && (
        <Card className="border-destructive">
          <CardContent className="flex items-start gap-3 p-6">
            <AlertCircle className="mt-1 h-6 w-6 flex-shrink-0 text-destructive" />
            <div>
              <p className="text-xl font-medium text-destructive">
                Couldn&apos;t load order history
              </p>
              <p className="mt-1 text-lg text-muted-foreground">
                Totals below are still accurate — they come from each session&apos;s saved stats.
                Timing charts need the orders. {ordersError}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <DrinksPerSessionChart points={series} />
      <DrinkLeaderboard drinks={leaderboard} />
      <ThroughputTable rates={rates} isLoading={orders === null && !ordersError} />
      <RushCurve
        sessions={endedSessions}
        ordersBySession={ordersBySession}
        formatLabel={formatLabel}
        formatTime={formatTime}
        isLoading={orders === null && !ordersError}
      />
    </div>
  );
}
