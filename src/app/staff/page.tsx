
import { OrderQueue } from '@/components/staff/OrderQueue';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function StaffQueuePage() {
  return (
    <div className="container mx-auto p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-5xl font-bold">Order Queue</h1>
        <p className="text-2xl text-muted-foreground">
          New orders will appear here in real-time.
        </p>
      </div>
      <Suspense fallback={<OrderQueueSkeleton />}>
        <OrderQueue initialOrders={[]} />
      </Suspense>
    </div>
  );
}
