'use client';

import { OrderQueue } from '@/components/staff/OrderQueue';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OrderHistory from '@/components/staff/OrderHistory';
import type { Order } from '@/lib/definitions';
import { useState, useEffect } from 'react';
import { fetchCompletedOrders } from '@/lib/actions';

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

function StaffQueuePage({ initialCompletedOrders }: { initialCompletedOrders: Order[] }) {
  const [completedOrders, setCompletedOrders] = useState(initialCompletedOrders);

  // This effect can be used to periodically re-fetch if needed,
  // but for now it just sets the initial state.
  useEffect(() => {
    setCompletedOrders(initialCompletedOrders);
  }, [initialCompletedOrders]);
  
  return (
    <div className="container mx-auto p-4 sm:p-8">
        <Tabs defaultValue="queue">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div className="flex-1">
                    <h1 className="text-5xl font-bold">Order Queue</h1>
                    <p className="text-2xl text-muted-foreground">
                        View pending and completed orders.
                    </p>
                </div>
                <TabsList className="grid w-full sm:w-[300px] grid-cols-2 h-auto">
                    <TabsTrigger value="queue" className="py-3 text-xl">Queue</TabsTrigger>
                    <TabsTrigger value="history" className="py-3 text-xl">History</TabsTrigger>
                </TabsList>
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

// This is the new root component for the page.
// It's a Server Component that fetches data and passes it to the client component.
export default function StaffPage() {
    return (
        <Suspense fallback={<div className="container mx-auto p-4 sm:p-8"><OrderQueueSkeleton /></div>}>
            <StaffPageData />
        </Suspense>
    );
}

async function StaffPageData() {
    const completedOrders = await fetchCompletedOrders();
    return <StaffQueuePage initialCompletedOrders={completedOrders} />;
}
