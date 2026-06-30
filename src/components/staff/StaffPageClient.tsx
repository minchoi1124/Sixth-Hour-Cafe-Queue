
'use client';

import { OrderQueue } from '@/components/staff/OrderQueue';
import { Suspense, useState, useTransition, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OrderHistory from '@/components/staff/OrderHistory';
import type { Order } from '@/lib/definitions';
import { Button } from '../ui/button';
import { toast } from '@/hooks/use-toast';
import { Coffee, History, Sigma } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { useCollection, useFirestore, useMemoFirebase, useCafeId } from '@/firebase';
import { query, where, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { ordersCol } from '@/lib/cafe-paths';

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
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState('queue');
  const firestore = useFirestore();
  const cafeId = useCafeId();

  const pendingOrdersQuery = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return query(
      ordersCol(firestore, cafeId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc')
    );
  }, [firestore, cafeId]);

  const completedOrdersQuery = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return query(
        ordersCol(firestore, cafeId),
        where('status', '==', 'completed'),
        orderBy('createdAt', 'desc')
    );
  }, [firestore, cafeId]);

  const archivedOrdersQuery = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return query(
      ordersCol(firestore, cafeId),
      where('status', '==', 'archived')
    );
  }, [firestore, cafeId]);

  const { data: pendingOrders } = useCollection<Order>(pendingOrdersQuery);
  const { data: completedOrders } = useCollection<Order>(completedOrdersQuery);
  const { data: archivedOrders } = useCollection<Order>(archivedOrdersQuery);

  const completedDrinksCount = useMemo(() => {
    return (completedOrders || []).reduce((total, order) => total + order.items.length, 0);
  }, [completedOrders]);

  const totalDrinksCount = useMemo(() => {
    const archivedCount = (archivedOrders || []).reduce((total, order) => total + order.items.length, 0);
    return completedDrinksCount + archivedCount;
  }, [completedDrinksCount, archivedOrders]);
  
  const handleClearHistory = () => {
    if (!firestore || !cafeId) return;
    startTransition(async () => {
      try {
        const snapshot = await getDocs(
          query(ordersCol(firestore, cafeId), where('status', '==', 'completed'))
        );
        if (!snapshot.empty) {
          const batch = writeBatch(firestore);
          snapshot.forEach((d) => batch.update(d.ref, { status: 'archived' }));
          await batch.commit();
        }
        toast({
          title: "History Cleared",
          description: "All completed orders have been archived.",
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not clear history. You may not have permission.",
        });
      }
    });
  }

  const displayOrders = completedOrders ?? [];

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
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-xl font-medium p-3 bg-secondary rounded-lg" title="Drinks completed in this session">
                    <Coffee className="w-6 h-6" />
                    <span>{completedDrinksCount} Drinks Made</span>
                  </div>

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
                          This is the total number of drinks made, including all previously archived orders.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4 text-center">
                        <p className="text-6xl font-bold text-primary">{totalDrinksCount}</p>
                        <p className="text-xl text-muted-foreground">Total Drinks</p>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {activeTab === 'history' && displayOrders.length > 0 && (
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isPending}>
                              <History className="mr-2 h-5 w-5" />
                              {isPending ? 'Clearing...' : 'Clear History'}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will archive all {displayOrders.length} completed orders. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleClearHistory} variant="destructive">
                                Yes, archive all
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                  )}
                  <TabsList className="grid w-full sm:w-[300px] grid-cols-2 h-auto">
                      <TabsTrigger value="queue" className="py-3 text-xl">Queue</TabsTrigger>
                      <TabsTrigger value="history" className="py-3 text-xl">History</TabsTrigger>
                  </TabsList>
                </div>
            </div>
        
            <TabsContent value="queue">
                <Suspense fallback={<OrderQueueSkeleton />}>
                    <OrderQueue status="pending" orders={pendingOrders} />
                </Suspense>
            </TabsContent>
            <TabsContent value="history">
                <Suspense fallback={<OrderQueueSkeleton />}>
                    <OrderHistory orders={displayOrders} />
                </Suspense>
            </TabsContent>
        </Tabs>
    </div>
  );
}
