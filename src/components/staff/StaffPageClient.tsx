
'use client';

import { OrderQueue } from '@/components/staff/OrderQueue';
import { Suspense, useState, useMemo, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SessionHistory from '@/components/staff/SessionHistory';
import {
  EndSessionButton,
  SessionChip,
  StartSessionDialog,
} from '@/components/staff/SessionControls';
import type { Cafe, MenuItem, MenuPreset, Order, Session } from '@/lib/definitions';
import { Button } from '../ui/button';
import { Coffee, Play, Sigma } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { useCollection, useDoc, useFirestore, useMemoFirebase, useCafeId } from '@/firebase';
import { query, where, orderBy } from 'firebase/firestore';
import { cafeDoc, drinksCol, ordersCol, presetsCol, sessionsCol } from '@/lib/cafe-paths';
import { countDrinks, suggestedLocation } from '@/lib/sessions';
import { cafeTimezone } from '@/lib/timezone';
import { TodaysMenu } from '@/components/staff/TodaysMenu';

function OrderQueueSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-6 rounded-lg bg-card border">
                    <Skeleton className="h-8 w-3/4 mb-4" />
                    <Skeleton className="h-4 w-1/2 mb-6" />
                    <div className="space-y-3">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-5/6" />
                    </div>
                    <Skeleton className="h-12 w-full mt-8" />
                </div>
            ))}
        </div>
    )
}

export default function StaffPageClient() {
  const [activeTab, setActiveTab] = useState('queue');
  const firestore = useFirestore();
  const cafeId = useCafeId();

  // Firestore's listener connection can go stale on a kiosk tablet — mobile
  // Safari suspends it when the tab backgrounds or the screen locks, and a
  // network blip can leave it half-open. The SDK does not always reconnect
  // promptly, which shows up as orders arriving minutes late. Re-creating the
  // query objects on focus/visibility/online forces a fresh subscribe, which is
  // what reloading the page does by hand. `useCollection` keeps its previous
  // data across a resubscribe, so this never flashes a loading skeleton.
  const [reconnectNonce, setReconnectNonce] = useState(0);
  useEffect(() => {
    const bump = () => setReconnectNonce(n => n + 1);
    const onVisible = () => {
      if (document.visibilityState === 'visible') bump();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', bump);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', bump);
    };
  }, []);

  // The cafe doc carries the pointer to the running session and the timezone
  // used to display session dates.
  const cafeRef = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return cafeDoc(firestore, cafeId);
  }, [firestore, cafeId]);
  const { data: cafe } = useDoc<Cafe>(cafeRef);
  const activeSessionId = cafe?.activeSessionId ?? null;
  const timezone = cafeTimezone(cafe?.timezone);

  // One sessions listener, shared by the all-time counter and the History tab.
  const sessionsQuery = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return query(sessionsCol(firestore, cafeId), orderBy('startsAt', 'desc'));
  }, [firestore, cafeId]);
  const { data: sessions } = useCollection<Session>(sessionsQuery);
  const activeSession = sessions?.find((s) => s.id === activeSessionId) ?? null;

  // The library and saved presets: needed to build a menu when starting a
  // session, and to resolve today's menu ids into drink names.
  const libraryQuery = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return drinksCol(firestore, cafeId);
  }, [firestore, cafeId]);
  const { data: library } = useCollection<MenuItem>(libraryQuery);

  const presetsQuery = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return presetsCol(firestore, cafeId);
  }, [firestore, cafeId]);
  const { data: presets } = useCollection<MenuPreset>(presetsQuery);

  // The queue is deliberately NOT session-scoped: whatever is pending needs
  // making, even if it arrived before this session started.
  const pendingOrdersQuery = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return query(
      ordersCol(firestore, cafeId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc')
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, cafeId, reconnectNonce]);

  // Live totals for the running session only — bounded to one session's orders
  // rather than every order the cafe has ever completed.
  const sessionOrdersQuery = useMemoFirebase(() => {
    if (!firestore || !cafeId || !activeSessionId) return null;
    return query(
      ordersCol(firestore, cafeId),
      where('sessionId', '==', activeSessionId),
      where('status', '==', 'completed')
    );
  }, [firestore, cafeId, activeSessionId]);

  const { data: pendingOrders } = useCollection<Order>(pendingOrdersQuery);
  const { data: sessionOrders } = useCollection<Order>(sessionOrdersQuery);

  const liveStats = useMemo(() => {
    const orders = sessionOrders ?? [];
    return { drinkCount: countDrinks(orders) };
  }, [sessionOrders]);

  // All-time reads only the frozen session snapshots plus the live session, so
  // it no longer grows a listener for every order ever made.
  const totalDrinksCount = useMemo(() => {
    const past = (sessions ?? [])
      .filter((s) => s.id !== activeSessionId)
      .reduce((total, s) => total + (s.drinkCount ?? 0), 0);
    return past + liveStats.drinkCount;
  }, [sessions, activeSessionId, liveStats.drinkCount]);

  const defaultLocation = suggestedLocation(sessions, cafe?.location);

  return (
    <div className="container mx-auto p-4 sm:p-8">
        <Tabs defaultValue="queue" onValueChange={setActiveTab}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div className="flex-1">
                    <h1 className="text-5xl font-bold">Order Queue</h1>
                    <p className="text-2xl text-muted-foreground">
                        View pending and completed orders.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  {activeSession ? (
                    <>
                      <SessionChip session={activeSession} timezone={timezone} />
                      <div className="flex items-center gap-2 text-xl font-medium p-3 bg-secondary rounded-lg" title="Drinks completed in this session">
                        <Coffee className="w-6 h-6" />
                        <span>{liveStats.drinkCount} Drinks Made</span>
                      </div>
                      {cafeId && (
                        <EndSessionButton
                          cafeId={cafeId}
                          session={activeSession}
                          drinkCount={liveStats.drinkCount}
                        />
                      )}
                    </>
                  ) : (
                    cafeId && (
                      <StartSessionDialog
                        cafeId={cafeId}
                        timezone={timezone}
                        defaultLocation={defaultLocation}
                        library={library ?? []}
                        presets={presets ?? []}
                      >
                        <Button className="py-6 text-xl">
                          <Play className="mr-2 h-5 w-5" />
                          Start Session
                        </Button>
                      </StartSessionDialog>
                    )
                  )}

                   <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="secondary" className="p-3 text-xl font-medium h-auto" title="View all-time total drinks made">
                        <Sigma className="w-6 h-6" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="text-3xl">All-Time Drink Counter</DialogTitle>
                        <DialogDescription className="text-lg">
                          Every drink made across all sessions, including the one running now.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4 text-center">
                        <p className="text-6xl font-bold text-primary">{totalDrinksCount}</p>
                        <p className="text-xl text-muted-foreground">Total Drinks</p>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <TabsList className="grid w-full sm:w-[300px] grid-cols-2 h-auto">
                      <TabsTrigger value="queue" className="py-3 text-xl">Queue</TabsTrigger>
                      <TabsTrigger value="history" className="py-3 text-xl">History</TabsTrigger>
                  </TabsList>
                </div>
            </div>

            {!activeSession && activeTab === 'queue' && (
              <div className="mb-6 rounded-md border border-dashed bg-card p-4 text-xl text-muted-foreground">
                No active session. Orders still come through — they&apos;ll be added to the
                next session you start.
              </div>
            )}

            <TabsContent value="queue">
                {activeSession && cafeId && (
                  <div className="mb-6">
                    <TodaysMenu
                      cafeId={cafeId}
                      session={activeSession}
                      library={library ?? []}
                      presets={presets ?? []}
                    />
                  </div>
                )}
                <Suspense fallback={<OrderQueueSkeleton />}>
                    <OrderQueue status="pending" orders={pendingOrders} activeSessionId={activeSessionId} />
                </Suspense>
            </TabsContent>
            <TabsContent value="history">
                {cafeId && (
                  <SessionHistory
                    cafeId={cafeId}
                    timezone={timezone}
                    activeSessionId={activeSessionId}
                    liveStats={liveStats}
                    sessions={sessions}
                  />
                )}
            </TabsContent>
        </Tabs>
    </div>
  );
}
