'use client';

import type { Category } from '@/lib/definitions';
import { handleUpdateCategory, handleDeleteCategory } from '@/lib/actions';
import { useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
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
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, query, orderBy, addDoc } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import { z } from 'zod';

const CategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters.'),
});

function AddCategoryForm() {
  const firestore = useFirestore();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    
    const formData = new FormData(event.currentTarget);
    const name = formData.get('name') as string;

    const validation = CategorySchema.safeParse({ name });
    if (!validation.success) {
        setError(validation.error.flatten().fieldErrors.name?.[0] ?? 'Invalid input.');
        setIsPending(false);
        return;
    }

    if (!firestore) {
      setError("Firestore is not available.");
      setIsPending(false);
      return;
    }

    try {
      const categoriesCol = collection(firestore, 'categories');
      await addDoc(categoriesCol, { name: validation.data.name });
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
  const [isEditing, setIsEditing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleUpdateAction = async (formData: FormData) => {
    await handleUpdateCategory(formData);
    toast({
        title: "Category Updated",
        description: `"${category.name}" has been updated.`
    });
    setIsEditing(false);
  }

  const handleDeleteAction = async (formData: FormData) => {
    // The alert dialog will close automatically, no need to manage state here.
    toast({
      title: "Category Deleted",
      description: `"${category.name}" has been deleted.`
    });
    await handleDeleteCategory(formData);
  }

  return (
    <div className="flex items-center gap-4">
      {isEditing ? (
        <form action={handleUpdateAction} ref={formRef} className="flex-grow flex items-center gap-4">
            <input type="hidden" name="categoryId" value={category.id} />
            <Input
                name="name"
                defaultValue={category.name}
                className="text-2xl h-14 flex-grow"
                autoFocus
                required
            />
            <Button type="submit" className="h-14 text-xl">
                Save
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="h-14 text-xl">
                Cancel
            </Button>
        </form>
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
                    This will delete the category "{category.name}". This action cannot be undone. 
                    Any drinks in this category will need to be re-categorized.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <form action={handleDeleteAction}>
                      <input type="hidden" name="categoryId" value={category.id} />
                      <AlertDialogAction asChild>
                          <Button type="submit" variant="destructive">Yes, delete</Button>
                      </AlertDialogAction>
                  </form>
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
  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'categories'), orderBy('name', 'asc'));
  }, [firestore]);

  const { data: categories, isLoading } = useCollection<Category>(categoriesQuery);

  const displayCategories = categories ?? initialCategories;
  
  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
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
      </CardContent>
    </Card>
  );
}
