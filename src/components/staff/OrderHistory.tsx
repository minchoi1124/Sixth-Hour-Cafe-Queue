
import type { Order } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Coffee, Tag, History } from 'lucide-react';
import { Badge } from '../ui/badge';

function HistoryCard({ order }: { order: Order }) {
  const date = new Date(order.createdAt).toLocaleString();

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
    </Card>
  );
};


const EmptyState = () => {
    return (
        <div className="flex flex-col items-center justify-center text-center py-24 px-4 rounded-lg bg-card border-2 border-dashed">
            <History className="w-24 h-24 text-muted-foreground/50 mb-6"/>
            <h2 className="text-4xl font-bold">No Completed Orders</h2>
            <p className="text-2xl text-muted-foreground mt-2">The order history is empty.</p>
        </div>
    )
}

export default function OrderHistory({ orders }: { orders: Order[] }) {
  if (!orders || orders.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {orders.map((order) => (
          <div key={order.id} className="h-full">
            <HistoryCard order={order} />
          </div>
        ))}
    </div>
  );
}
