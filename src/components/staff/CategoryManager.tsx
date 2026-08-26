'use client';

import type { Category } from '@/lib/definitions';
import { useRef, useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { AlertCircle, PlusCircle, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
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
import { useCollection, useFirestore, useMemoFirebase, useCafeId } from '@/firebase';
import { query, orderBy, addDoc, updateDoc, deleteDoc, getDocs, writeBatch, where } from 'firebase/firestore';
import { categoriesCol, categoryDoc, drinksCol } from '@/lib/cafe-paths';
import { Skeleton } from '../ui/skeleton';
import { z } from 'zod';

const CategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters.'),
});

function AddCategoryForm() {
  const firestore = useFirestore();
  const cafeId = useCafeId();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    
    if (!firestore || !cafeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not connect to database.' });
      setIsPending(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const name = formData.get('name') as string;

    const validation = CategorySchema.safeParse({ name });
    if (!validation.success) {
        setError(validation.error.flatten().fieldErrors.name?.[0] ?? 'Invalid input.');
        setIsPending(false);
        return;
    }

    try {
      await addDoc(categoriesCol(firestore, cafeId), { name: validation.data.name });
      toast({ title: "Category Added!", description: `"${validation.data.name}" added.` });
      formRef.current?.reset();
    } catch (e: any) {
      console.error("Failed to add category:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not add category. You may not have permission."
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} ref={formRef} className="flex items-start gap-4">
      <div className="flex-grow space-y-2">
        <Label htmlFor="new-category-name" className="sr-only">New Category Name</Label>
        <Input
          id="new-category-name"
          name="name"
          placeholder="e.g. Specials"
          className="text-2xl h-14"
          required
        />
        {error && (
          <p className="text-destructive text-lg flex items-center gap-2 pt-1">
            <AlertCircle className="h-5 w-5" /> {error}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isPending} size="lg" className="h-14 text-xl">
        <PlusCircle className="mr-2 h-6 w-6" />
        {isPending ? 'Adding...' : 'Add'}
      </Button>
    </form>
  )
}

function CategoryEditRow({ category }: { category: Category }) {
  const firestore = useFirestore();
  const cafeId = useCafeId();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [name, setName] = useState(category.name);

  const handleUpdate = async () => {
    if (!firestore || !cafeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database connection failed.' });
      return;
    }
    if (name === category.name) {
      setIsEditing(false);
      return;
    }
    const validation = CategorySchema.safeParse({ name });
    if (!validation.success) {
        toast({ variant: 'destructive', title: 'Invalid Name', description: validation.error.flatten().fieldErrors.name?.[0] });
        return;
    }

    setIsPending(true);
    try {
      const batch = writeBatch(firestore);

      // 1. Update the category document itself
      const categoryRef = categoryDoc(firestore, cafeId, category.id);
      batch.update(categoryRef, { name: validation.data.name });

      // 2. Find all drinks with the old category name and update them
      const drinksRef = drinksCol(firestore, cafeId);
      const q = query(drinksRef, where("category", "==", category.name));
      const drinksSnapshot = await getDocs(q);

      drinksSnapshot.forEach((drinkDoc) => {
        batch.update(drinkDoc.ref, { category: validation.data.name });
      });

      // 3. Commit the batch
      await batch.commit();

      toast({ title: 'Category Updated', description: `Renamed to "${validation.data.name}" and updated ${drinksSnapshot.size} drink(s).` });
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Update Failed', description: 'You may not have permission.' });
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async () => {
     if (!firestore || !cafeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database connection failed.' });
      return;
    }
    try {
      await deleteDoc(categoryDoc(firestore, cafeId, category.id));
      toast({ title: 'Category Deleted', description: `"${category.name}" has been removed.` });
    } catch (e) {
       console.error(e);
      toast({ variant: 'destructive', title: 'Delete Failed', description: 'You may not have permission.' });
    }
  };

  return (
    <div className="flex items-center gap-4">
      {isEditing ? (
        <div className="flex-grow flex items-center gap-4">
            <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-2xl h-14 flex-grow"
                autoFocus
                required
            />
            <Button onClick={handleUpdate} disabled={isPending} className="h-14 text-xl">
                {isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => {setIsEditing(false); setName(category.name)}} className="h-14 text-xl">
                Cancel
            </Button>
        </div>
      ) : (
        <>
            <p className="text-2xl flex-grow">{category.name}</p>
            <Button variant="outline" onClick={() => setIsEditing(true)} className="text-xl h-14">
                Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="text-xl h-14">
                    <Trash2 className="mr-2"/> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete the category &quot;{category.name}&quot;. This action cannot be undone.
                    Any drinks in this category will need to be re-categorized.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction asChild>
                      <Button onClick={handleDelete} variant="destructive">Yes, delete</Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </>
      )}
    </div>
  );
}


export default function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const firestore = useFirestore();
  const cafeId = useCafeId();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return query(categoriesCol(firestore, cafeId), orderBy('name', 'asc'));
  }, [firestore, cafeId]);

  const { data: categories, isLoading } = useCollection<Category>(categoriesQuery);

  const displayCategories = categories ?? initialCategories;
  
  if (!isClient) {
    return null;
  }

  return (
    <div className="space-y-6">
        <h3 className="text-2xl font-semibold">Add New Category</h3>
        <AddCategoryForm />
        
        <hr className="border-border"/>

        <h3 className="text-2xl font-semibold">Existing Categories</h3>
        <div className="space-y-4">
          {isLoading && displayCategories.length === 0 ? (
            <div className="space-y-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : displayCategories.length > 0 ? (
            displayCategories.map(cat => (
              <CategoryEditRow key={cat.id} category={cat} />
            ))
          ) : (
            <p className="text-muted-foreground text-xl text-center py-4">
              No categories found. Add one above to get started.
            </p>
          )}
        </div>
    </div>
  );
}

/**
 * Category management lives behind a dialog so the menu page isn't carrying a
 * permanently open form below the drink list.
 */
export function ManageCategoriesDialog({
  categories,
  children,
}: {
  categories: Category[];
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl">Manage categories</DialogTitle>
          <DialogDescription className="text-lg">
            Renaming a category updates every drink in it. Deleting one leaves its
            drinks uncategorized.
          </DialogDescription>
        </DialogHeader>
        <CategoryManager initialCategories={categories} />
      </DialogContent>
    </Dialog>
  );
}
