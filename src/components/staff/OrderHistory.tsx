'use client';

import type { Order } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Coffee, Tag, History, Trash2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { deleteDoc } from 'firebase/firestore';
import { Button } from '../ui/button';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCafeId } from '@/firebase';
import { orderDoc } from '@/lib/cafe-paths';
import { toDate } from '@/lib/sessions';
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


function HistoryCard({ order, onDeleted }: { order: Order; onDeleted?: () => void }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const cafeId = useCafeId();

  const handleDelete = async () => {
    if (!firestore || !cafeId) return;
    setIsDeleting(true);
    try {
        await deleteDoc(orderDoc(firestore, cafeId, order.id));
        toast({
            title: "Order Deleted",
            description: `Order for ${order.customerName} has been permanently deleted.`
        });
        // Lets the parent re-freeze an ended session's totals so the history
        // card doesn't keep quoting a count that no longer holds.
        onDeleted?.();
    } catch (error) {
        console.error("Failed to delete order:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not delete the order. You may not have permission.",
        });
        // We don't need to setIsDeleting(false) on failure
        // because the component will be gone on success anyway.
        // If it fails, we want the button to remain disabled to prevent retries.
    }
  }

  const createdAt = toDate(order.createdAt);
  const date = createdAt ? createdAt.toLocaleString() : 'Date not available';

  return (
    <Card className="flex flex-col h-full overflow-hidden border-primary/20 shadow-lg">
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
          {order.items.map((item, index) => (
            <li key={`${item.id}-${index}`} className="text-2xl">
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
      <CardFooter>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="w-full text-xl py-6"
              disabled={isDeleting}
            >
              <Trash2 className="w-6 h-6 mr-2"/>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the order for &quot;{order.customerName}&quot;.
                This action cannot be undone and the data will be lost forever.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} variant="destructive">
                Yes, permanently delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
};


const EmptyState = () => {
    return (
        <div className="flex flex-col items-center justify-center text-center py-24 px-4 rounded-lg bg-card border-2 border-dashed">
            <History className="w-24 h-24 text-muted-foreground/50 mb-6"/>
            <h2 className="text-4xl font-bold">No Completed Orders</h2>
            <p className="text-2xl text-muted-foreground mt-2">No drinks were made in this session.</p>
        </div>
    )
}

/** The completed orders belonging to one session. */
export default function OrderHistory({
  orders,
  onOrderDeleted,
}: {
  orders: Order[];
  onOrderDeleted?: () => void;
}) {
  if (!orders || orders.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {orders.map((order) => (
          <div key={order.id} className="h-full">
            <HistoryCard order={order} onDeleted={onOrderDeleted} />
          </div>
        ))}
    </div>
  );
}
