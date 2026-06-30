
'use client';

import OrderForm from '@/components/customer/OrderForm';
import { Logo } from '@/components/Logo';
import type { MenuItem } from '@/lib/definitions';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { query, orderBy } from 'firebase/firestore';
import { drinksCol } from '@/lib/cafe-paths';

export default function CustomerPageClient({
  cafeId,
  location,
  menu: initialMenu,
  instagramUrl,
}: {
  cafeId: string;
  location: string;
  menu: MenuItem[];
  instagramUrl: string | null;
}) {
  const firestore = useFirestore();

  const menuQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(drinksCol(firestore, cafeId), orderBy('order', 'asc'));
  }, [firestore, cafeId]);

  const { data: realTimeMenu } = useCollection<MenuItem>(menuQuery);

  const displayMenu = realTimeMenu ?? initialMenu;
  const availableMenu = displayMenu.filter(item => item.inStock);

  return (
    <>
      <main className="container mx-auto max-w-2xl p-4 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Logo className="w-24 h-24 mb-4" />
          <h1 className="text-5xl md:text-6xl font-bold tracking-tighter">
            Sixth Hour Cafe
          </h1>
          {location && (
            <p className="mt-2 text-2xl font-medium text-primary">{location}</p>
          )}
          <p className="mt-4 text-xl text-muted-foreground">
            Place your order below.
          </p>
        </div>

        <div className="mt-12">
          <OrderForm cafeId={cafeId} menu={availableMenu} instagramUrl={instagramUrl} />
        </div>
      </main>
    </>
  );
}
