'use client';

import { useCollection, useFirestore, useMemoFirebase, useCafeId } from '@/firebase';
import { query, orderBy } from 'firebase/firestore';
import { drinksCol, categoriesCol } from '@/lib/cafe-paths';
import type { MenuItem, Category } from '@/lib/definitions';
import MenuManager from '@/components/staff/MenuManager';
import { AddDrinkForm } from '@/components/staff/AddDrinkForm';
import { Separator } from '@/components/ui/separator';
import CategoryManager from '@/components/staff/CategoryManager';
import { Skeleton } from '@/components/ui/skeleton';

function MenuPageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Skeleton className="h-14 w-1/2" />
        <Skeleton className="h-6 w-3/4" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <div className="flex justify-end">
          <Skeleton className="h-12 w-40" />
        </div>
      </div>
      <Separator />
      <Skeleton className="h-32 w-full" />
      <Separator />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}


export default function MenuManagementPage() {
  const firestore = useFirestore();
  const cafeId = useCafeId();

  const menuQuery = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return query(drinksCol(firestore, cafeId), orderBy('order', 'asc'));
  }, [firestore, cafeId]);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return query(categoriesCol(firestore, cafeId), orderBy('name', 'asc'));
  }, [firestore, cafeId]);

  const { data: menu, isLoading: isLoadingMenu } = useCollection<MenuItem>(menuQuery);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);

  if (isLoadingMenu || isLoadingCategories) {
    return (
      <div className="container mx-auto p-4 sm:p-8">
        <MenuPageSkeleton />
      </div>
    );
  }

  const safeMenu = menu ?? [];
  const safeCategories = categories ?? [];

  return (
    <div className="container mx-auto p-4 sm:p-8 space-y-12">
      <div>
        <h1 className="text-5xl font-bold">Menu Management</h1>
        <p className="text-2xl text-muted-foreground">
          Update drink availability, names, categories, and display order.
        </p>
      </div>
      <MenuManager menu={safeMenu} categories={safeCategories} />
      
      <Separator />

      <div>
        <h2 className="text-4xl font-bold mb-4">Manage Categories</h2>
        <CategoryManager initialCategories={safeCategories} />
      </div>

      <Separator />

      <div>
          <h2 className="text-4xl font-bold mb-4">Add a New Drink</h2>
          <AddDrinkForm categories={safeCategories} />
      </div>
    </div>
  );
}
