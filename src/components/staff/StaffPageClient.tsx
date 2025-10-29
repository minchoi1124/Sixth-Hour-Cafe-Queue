
'use client';

import { OrderQueue } from '@/components/staff/OrderQueue';
import { Suspense, useState, useEffect, useTransition, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OrderHistory from '@/components/staff/OrderHistory';
import type { Order } from '@/lib/definitions';
import { Button } from '../ui/button';
import { clearCompletedOrders } from '@/lib/actions';
import { toast } from '@/hooks/use-toast';
import { Coffee, History } from 'lucide-react';
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

export default function StaffPageClient({ initialCompletedOrders }: { initialCompletedOrders: Order[] }) {
  const [completedOrders, setCompletedOrders] = useState(initialCompletedOrders);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState('queue');

  useEffect(() => {
    setCompletedOrders(initialCompletedOrders);
  }, [initialCompletedOrders]);

  const completedDrinksCount = useMemo(() => {
    return completedOrders.reduce((total, order) => total + order.items.length, 0);
  }, [completedOrders]);
  
  const handleClearHistory = () => {
    startTransition(async () => {
      try {
        await clearCompletedOrders();
        setCompletedOrders([]); // Optimistically update the UI
        toast({
          title: "History Cleared",
          description: "All completed orders have been removed.",
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
                  {activeTab === 'history' && completedOrders.length > 0 && (
                     <>
                      <div className="flex items-center gap-2 text-xl font-medium p-3 bg-secondary rounded-lg">
                        <Coffee className="w-6 h-6" />
                        <span>{completedDrinksCount} Drinks Made</span>
                      </div>
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
                                This will permanently delete all {completedOrders.length} completed orders. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleClearHistory} variant="destructive">
                                Yes, delete all
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                     </>
                  )}
                  <TabsList className="grid w-full sm:w-[300px] grid-cols-2 h-auto">
                      <TabsTrigger value="queue" className="py-3 text-xl">Queue</TabsTrigger>
                      <TabsTrigger value="history" className="py-3 text-xl">History</TabsTrigger>
                  </TabsList>
                </div>
            </div>
        
            <TabsContent value="queue">
                <Suspense fallback={<OrderQueueSkeleton />}>
                    <OrderQueue status="pending" />
                </Suspense>
            </TabsContent>
            <TabsContent value="history">
                <Suspense fallback={<OrderQueueSkeleton />}>
                    <OrderHistory orders={completedOrders} />
                </Suspense>
            </TabsContent>
        </Tabs>
    </div>
  );
}
