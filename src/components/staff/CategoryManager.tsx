'use client';

import type { Category } from '@/lib/definitions';
import { handleAddCategory, handleUpdateCategory, handleDeleteCategory, CategoryFormState } from '@/lib/actions';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
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

const initialState: CategoryFormState = { message: '', errors: {}, success: false };

function AddCategoryForm() {
  const [state, dispatch] = useActionState(handleAddCategory, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      toast({ title: "Category Added!", description: state.message });
    }
  }, [state]);

  const { pending } = useFormStatus();

  return (
    <form action={dispatch} ref={formRef} className="flex items-start gap-4">
      <div className="flex-grow space-y-2">
        <Label htmlFor="new-category-name" className="sr-only">New Category Name</Label>
        <Input
          id="new-category-name"
          name="name"
          placeholder="e.g. Specials"
          className="text-2xl h-14"
          required
        />
        {state.errors?.name && (
          <p className="text-destructive text-lg flex items-center gap-2 pt-1">
            <AlertCircle className="h-5 w-5" /> {state.errors.name}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending} size="lg" className="h-14 text-xl">
        <PlusCircle className="mr-2 h-6 w-6" />
        {pending ? 'Adding...' : 'Add'}
      </Button>
    </form>
  )
}

function CategoryEditRow({ category }: { category: Category }) {
  const { pending } = useFormStatus();
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    toast({
        title: "Category Updated",
        description: `"${category.name}" has been updated.`
    })
    setIsEditing(false);
  }

  return (
    <div className="flex items-center gap-4">
      {isEditing ? (
        <form action={handleUpdateCategory} onSubmit={handleSave} className="flex-grow flex items-center gap-4">
            <input type="hidden" name="categoryId" value={category.id} />
            <Input
                name="name"
                defaultValue={category.name}
                className="text-2xl h-14 flex-grow"
                autoFocus
                required
            />
            <Button type="submit" disabled={pending} className="h-14 text-xl">
                {pending ? 'Saving...' : 'Save'}
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
                  <form action={handleDeleteCategory}>
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


export default function CategoryManager({ categories }: { categories: Category[] }) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <h3 className="text-2xl font-semibold">Add New Category</h3>
        <AddCategoryForm />
        
        <hr className="border-border"/>

        <h3 className="text-2xl font-semibold">Existing Categories</h3>
        <div className="space-y-4">
          {categories.map(cat => (
            <CategoryEditRow key={cat.id} category={cat} />
          ))}
          {categories.length === 0 && (
            <p className="text-muted-foreground text-xl text-center py-4">
              No categories found. Add one above to get started.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
