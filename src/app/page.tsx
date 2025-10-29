'use client';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
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
  const { isUserLoading, user } = useUser();

  const menuQuery = useMemoFirebase(() => {
    // We must wait for an authenticated user before we can query.
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'drinks'),
      where('inStock', '==', true),
      orderBy('order', 'asc')
    );
  }, [firestore, user]);

  const { data: menu, isLoading: isLoadingMenu } = useCollection<MenuItem>(menuQuery);
  
  // Show skeleton if the user is authenticating OR the menu is loading
  const showSkeleton = isUserLoading || (user && isLoadingMenu);

  return (
    <CustomerPageClient>
      {showSkeleton ? <MenuSkeleton /> : <CustomerPageClient.Form menu={menu ?? []} />}
    </CustomerPageClient>
  );
}
