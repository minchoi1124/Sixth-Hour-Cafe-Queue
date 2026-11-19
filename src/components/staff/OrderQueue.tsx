
'use client';

import { useState } from 'react';
import { Timestamp, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useFirestore, useCafeId } from '@/firebase';
import { orderDoc } from '@/lib/cafe-paths';
import type { Order } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Coffee, Tag, History, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';

const OrderCard = ({
  order,
  status,
  activeSessionId,
}: {
  order: Order;
  status: 'pending' | 'completed';
  activeSessionId: string | null;
}) => {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const cafeId = useCafeId();

  const handleComplete = async () => {
    if (!firestore || !cafeId) return;
    setIsCompleting(true);
    try {
        await updateDoc(orderDoc(firestore, cafeId, order.id), {
            status: 'completed',
            completedAt: serverTimestamp(),
        });
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

  const handleDelete = async () => {
    if (!firestore || !cafeId) return;
    setIsDeleting(true);
    try {
        // Soft delete: drop it from the queue but keep the doc so it can be
        // restored. Cancelled orders never count towards a session's totals.
        await updateDoc(orderDoc(firestore, cafeId, order.id), { status: 'cancelled' });
        toast({
            title: 'Order deleted',
            description: `${order.customerName}'s order was removed from the queue.`,
            action: (
                <ToastAction altText="Undo" onClick={handleUndo}>
                    Undo
                </ToastAction>
            ),
        });
        // Real-time listener removes the card on success.
    } catch (error) {
        console.error("Failed to delete order:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not delete the order. You may not have permission.",
        });
        setIsDeleting(false);
    }
  };

  const handleUndo = async () => {
    if (!firestore || !cafeId) return;
    try {
        // Adoption only sweeps pending/completed orders, so a cancelled orphan
        // would come back unassigned. Attach it to the running session here.
        await updateDoc(orderDoc(firestore, cafeId, order.id), {
            status: 'pending',
            ...(order.sessionId ? {} : { sessionId: activeSessionId }),
        });
    } catch (error) {
        console.error("Failed to restore order:", error);
        toast({
            variant: "destructive",
            title: "Could not undo",
            description: "The order could not be restored. Please refresh.",
        });
    }
  };

  const createdAtTimestamp = order.createdAt as unknown as Timestamp;
  const created = createdAtTimestamp ? createdAtTimestamp.toDate() : null;
  const date = created ? created.toLocaleString() : 'Processing...';
  // Phones: just the time ("8:27 AM"), with the day only if it isn't today.
  const shortDate = created
    ? (created.toDateString() === new Date().toDateString()
        ? ''
        : `${created.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, `)
      + created.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : 'Processing...';

  // Phones get a tighter card (less padding, smaller type) so several orders
  // fit on screen; from md up it's the tablet card as before.
  return (
    <Card className="flex flex-col h-full overflow-hidden border-primary/20 shadow-lg hover:shadow-xl hover:border-primary/40 transition-all duration-300">
      <CardHeader className="space-y-0.5 p-4 pb-2 md:space-y-1.5 md:p-6 md:pb-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-3xl tracking-tight md:gap-3 md:text-4xl">
            {order.number ? (
              <span className="flex-shrink-0 text-primary/70">#{order.number}</span>
            ) : (
              <Tag className="w-8 h-8 flex-shrink-0 text-primary/70" />
            )}
            {/* A long single-word name breaks rather than running under the
                delete button; the number beside it never breaks. */}
            <span className="min-w-0 [overflow-wrap:anywhere]">{order.customerName}</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-1 h-11 w-11 flex-shrink-0 text-muted-foreground hover:text-destructive md:mr-0 md:mt-0 md:h-10 md:w-10"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label="Delete order"
          >
            <Trash2 className="w-6 h-6" />
          </Button>
        </div>
        <CardDescription className="text-base md:text-lg" title={date}>
          <span className="md:hidden">{shortDate}</span>
          <span className="hidden md:inline">{date}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-4 md:px-6 md:pb-6">
        <ul className="space-y-2 md:space-y-3">
          {order.items.map((item, index) => (
            <li key={`${item.id}-${index}`} className="text-xl md:text-2xl">
                <div className="flex items-start gap-3">
                    <Coffee className="w-6 h-6 text-muted-foreground flex-shrink-0 mt-1" />
                    <div className="flex-1">
                        <span>{item.name}</span>
                        {item.modifications && item.modifications.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {item.modifications.map(mod => (
                                    <Badge key={mod} variant="secondary" className="text-base">
                                        {mod}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </li>
          ))}
        </ul>
      </CardContent>
      {status === 'pending' && (
        <CardFooter className="px-4 pb-4 md:px-6 md:pb-6">
            <Button
            className="w-full py-6 text-xl md:py-7 md:text-2xl"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
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
            <div className="flex flex-col items-center justify-center text-center py-12 md:py-24 px-4 rounded-lg bg-card border-2 border-dashed">
                <History className="w-16 h-16 md:w-24 md:h-24 text-muted-foreground/50 mb-6"/>
                <h2 className="text-3xl md:text-4xl font-bold">No Completed Orders</h2>
                <p className="text-xl md:text-2xl text-muted-foreground mt-2">The order history is empty.</p>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center justify-center text-center py-12 md:py-24 px-4 rounded-lg bg-card border-2 border-dashed">
            <Coffee className="w-16 h-16 md:w-24 md:h-24 text-muted-foreground/50 mb-6"/>
            <h2 className="text-3xl md:text-4xl font-bold">All Caught Up!</h2>
            <p className="text-xl md:text-2xl text-muted-foreground mt-2">Waiting for new orders...</p>
        </div>
    )
}

export function OrderQueue({
  status,
  orders,
  activeSessionId,
}: {
  status: 'pending' | 'completed';
  orders: Order[] | null;
  activeSessionId: string | null;
}) {
  if (orders === null) {
    return <OrderQueueSkeleton />;
  }

  if (orders?.length === 0) {
    return <EmptyState status={status} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
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
            <OrderCard order={order} status={status} activeSessionId={activeSessionId} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
