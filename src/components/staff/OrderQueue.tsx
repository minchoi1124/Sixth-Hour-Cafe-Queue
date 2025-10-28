'use client';

import { useState, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Order } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { markOrderAsCompleted } from '@/lib/actions';
import { Check, Coffee, Tag } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';

const OrderCard = ({ order }: { order: Order; }) => {
  const [isCompleting, setIsCompleting] = useState(false);
  const { toast } = useToast();

  const handleComplete = async () => {
    setIsCompleting(true);
    // Optimistically update UI, then call server action
    try {
        await markOrderAsCompleted(order.id);
        toast({
            title: "Order Completed!",
            description: `${order.customerName}'s order is done.`,
        });
    } catch (error) {
        console.error("Failed to complete order:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not complete the order. Please try again.",
        });
        setIsCompleting(false); // Re-enable button on error
    }
  };
  
  return (
    <Card className="flex flex-col h-full overflow-hidden border-primary/20 shadow-lg hover:shadow-xl hover:border-primary/40 transition-all duration-300">
      <CardHeader className="pb-4">
        <CardTitle className="text-4xl tracking-tight flex items-center gap-3">
          <Tag className="w-8 h-8 text-primary/70" />
          {order.customerName}
        </CardTitle>
        <CardDescription className="text-lg">
          {new Date(order.createdAt).toLocaleTimeString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-3">
          {order.items.map((item) => (
            <li key={item.id} className="text-2xl flex items-center gap-3">
              <Coffee className="w-6 h-6 text-muted-foreground flex-shrink-0" />
              <span>{item.name}</span>
            </li>
          ))}
        </ul>
      </CardContent>
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

export function OrderQueue({ initialOrders }: { initialOrders: Order[] }) {
  const firestore = useFirestore();

  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'orders'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc')
    );
  }, [firestore]);

  const { data: orders, isLoading, error } = useCollection<Order>(ordersQuery);

  const displayOrders = orders ?? initialOrders;

  if (isLoading && !displayOrders.length) {
    return <OrderQueueSkeleton />;
  }

  if (error) {
    return (
      <div className="text-center py-24 text-destructive">
        <h2 className="text-3xl font-bold">Error loading orders</h2>
        <p className="text-xl mt-2">{error.message}</p>
      </div>
    );
  }

  if (displayOrders.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-24 px-4 rounded-lg bg-card border-2 border-dashed">
            <Coffee className="w-24 h-24 text-muted-foreground/50 mb-6"/>
            <h2 className="text-4xl font-bold">All Caught Up!</h2>
            <p className="text-2xl text-muted-foreground mt-2">The order queue is empty. Waiting for new orders...</p>
        </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      <AnimatePresence>
        {displayOrders.map((order) => (
          <motion.div
            key={order.id}
            layout
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, filter: 'blur(10px)', scale: 0.9, transition: { duration: 0.3 } }}
            className="h-full"
          >
            <OrderCard order={order} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
