'use client';

import { useState, useEffect } from 'react';
import type { Order } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { markOrderAsCompleted } from '@/lib/actions';
import { Check, Coffee, Tag } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

async function fetchOrders(): Promise<Order[]> {
  const res = await fetch('/api/orders', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to fetch orders');
  }
  return res.json();
}

const OrderCard = ({ order, onComplete }: { order: Order; onComplete: (id: string) => void }) => {
  const [isCompleting, setIsCompleting] = useState(false);
  const { toast } = useToast();

  const handleComplete = async () => {
    setIsCompleting(true);
    await markOrderAsCompleted(order.id);
    toast({
        title: "Order Completed!",
        description: `${order.customerName}'s order is done.`,
    });
    // The onComplete callback will be called optimistically by the parent
    // No need to call it here to avoid race conditions with polling
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
          onClick={() => { onComplete(order.id); handleComplete(); }} 
          disabled={isCompleting}
        >
          <Check className="w-7 h-7 mr-2" />
          {isCompleting ? 'Completing...' : 'Mark as Done'}
        </Button>
      </CardFooter>
    </Card>
  );
};


export function OrderQueue({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const newOrders = await fetchOrders();
        setOrders(newOrders);
      } catch (error) {
        console.error(error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, []);

  const handleCompleteOrder = (orderId: string) => {
    setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
  };

  if (orders.length === 0) {
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
        {orders.map((order) => (
          <motion.div
            key={order.id}
            layout
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="h-full"
          >
            <OrderCard order={order} onComplete={handleCompleteOrder} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
