
'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { MenuItem } from '@/lib/definitions';
import CustomerPageClient from '@/components/customer/CustomerPageClient';
import { Skeleton } from '@/components/ui/skeleton';

function MenuSkeleton() {
  return (
    <div className="space-y-12">
        <div className="space-y-4">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
        </div>
         <div className="space-y-4">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-32 w-full" />
        </div>
    </div>
  )
}

export default function CustomerPage() {
  const firestore = useFirestore();

  const menuQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'drinks'),
      where('inStock', '==', true),
      orderBy('order', 'asc')
    );
  }, [firestore]);

  const { data: menu, isLoading: isLoadingMenu } = useCollection<MenuItem>(menuQuery);

  // Show skeleton while the menu is loading
  const showSkeleton = isLoadingMenu;

  return (
    <CustomerPageClient>
      {showSkeleton ? <MenuSkeleton /> : <CustomerPageClient.Form menu={menu ?? []} />}
    </CustomerPageClient>
  );
}
