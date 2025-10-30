
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchCompletedOrders } from '@/lib/actions';
import StaffPageClient from '@/components/staff/StaffPageClient';

// Revalidate every 30 seconds to ensure initial data is fresh
export const revalidate = 30;

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

// This is the new root component for the page.
// It's a Server Component that fetches data and passes it to the client component.
export default async function StaffPage() {
    const completedOrders = await fetchCompletedOrders();
    
    return (
        <Suspense fallback={<div className="container mx-auto p-4 sm:p-8"><OrderQueueSkeleton /></div>}>
            <StaffPageClient initialCompletedOrders={completedOrders} />
        </Suspense>
    );
}
