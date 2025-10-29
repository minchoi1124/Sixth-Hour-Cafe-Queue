
'use client';

import { useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Order } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { markOrderAsCompleted } from '@/lib/actions';
import { Check, Coffee, Tag, History } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';

const OrderCard = ({ order, status }: { order: Order; status: 'pending' | 'completed' }) => {
  const [isCompleting, setIsCompleting] = useState(false);
  const { toast } = useToast();

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
        await markOrderAsCompleted(order.id);
        // Optimistic update handled by real-time listener removing the card
    } catch (error) {
        console.error("Failed to complete order:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not complete the order. You may not have permission.",
        });
        setIsCompleting(false); // Re-enable button on error
    }
  };
  
  const createdAtTimestamp = order.createdAt as unknown as Timestamp;
  const date = createdAtTimestamp ? createdAtTimestamp.toDate().toLocaleString() : 'Processing...';

  return (
    <Card className="flex flex-col h-full overflow-hidden border-primary/20 shadow-lg hover:shadow-xl hover:border-primary/40 transition-all duration-300">
      <CardHeader className="pb-4">
        <CardTitle className="text-4xl tracking-tight flex items-center gap-3">
          <Tag className="w-8 h-8 text-primary/70" />
          {order.customerName}
        </CardTitle>
        <CardDescription className="text-lg">
          {date}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-3">
          {order.items.map((item) => (
            <li key={item.id} className="text-2xl">
                <div className="flex items-start gap-3">
                    <Coffee className="w-6 h-6 text-muted-foreground flex-shrink-0 mt-1" />
                    <div className="flex-1">
                        <span>{item.name}</span>
                        {item.oatMilk && (
                            <Badge variant="secondary" className="ml-2 text-base">Oat Milk</Badge>
                        )}
                    </div>
                </div>
            </li>
          ))}
        </ul>
      </CardContent>
      {status === 'pending' && (
        <CardFooter>
            <Button 
            className="w-full text-2xl py-7" 
            onClick={handleComplete} 
            disabled={isCompleting}
            >
            <Check className="w-7 h-7 mr-2" />
            {isCompleting ? 'Completing...' : 'Mark as Done'}
            </Button>
        </CardFooter>
      )}
    </Card>
  );
};

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

const EmptyState = ({ status }: { status: 'pending' | 'completed' }) => {
    if (status === 'completed') {
        return (
            <div className="flex flex-col items-center justify-center text-center py-24 px-4 rounded-lg bg-card border-2 border-dashed">
                <History className="w-24 h-24 text-muted-foreground/50 mb-6"/>
                <h2 className="text-4xl font-bold">No Completed Orders</h2>
                <p className="text-2xl text-muted-foreground mt-2">The order history is empty.</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center text-center py-24 px-4 rounded-lg bg-card border-2 border-dashed">
            <Coffee className="w-24 h-24 text-muted-foreground/50 mb-6"/>
            <h2 className="text-4xl font-bold">All Caught Up!</h2>
            <p className="text-2xl text-muted-foreground mt-2">The order queue is empty. Waiting for new orders...</p>
        </div>
    )
}

export function OrderQueue({ status }: { status: 'pending' | 'completed' }) {
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const orderDirection = status === 'pending' ? 'asc' : 'desc';
    return query(
      collection(firestore, 'orders'),
      where('status', '==', status),
      orderBy('createdAt', orderDirection)
    );
  }, [firestore, status]);

  const { data: orders, isLoading, error } = useCollection<Order>(ordersQuery);

  if (isLoading && !orders) {
    return <OrderQueueSkeleton />;
  }

  if (error) {
    // This will now be caught by Next.js's error boundary via the FirebaseErrorListener
    throw error;
  }

  if (orders?.length === 0) {
    return <EmptyState status={status} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      <AnimatePresence>
        {orders?.map((order) => (
          <motion.div
            key={order.id}
            layout
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, filter: 'blur(10px)', scale: 0.9, transition: { duration: 0.3 } }}
            className="h-full"
          >
            <OrderCard order={order} status={status} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
