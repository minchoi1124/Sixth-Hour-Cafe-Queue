'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ModificationEditor } from '@/components/staff/ModificationEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { Category, MenuItem, Modification } from '@/lib/definitions';
import { useFirestore, useCafeId } from '@/firebase';
import { addDoc } from 'firebase/firestore';
import { drinksCol } from '@/lib/cafe-paths';
import { z } from 'zod';
import { Textarea } from '../ui/textarea';

const AddDrinkSchema = z.object({
  name: z.string().trim().min(2, 'Drink name must be at least 2 characters'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters'),
  category: z.string().trim().min(1, 'Please select a category'),
  modifications: z.array(z.object({
    id: z.string(),
    name: z.string().trim().min(2, 'Modification name must be at least 2 characters'),
    default: z.boolean(),
  })),
});

function AddDrinkForm({
  categories,
  menu,
  onAdded,
}: {
  categories: Category[];
  menu: MenuItem[];
  onAdded?: () => void;
}) {
  const firestore = useFirestore();
  const cafeId = useCafeId();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, setIsPending] = useState(false);
  const [errors, setErrors] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);
  const [modifications, setModifications] = useState<Modification[]>([]);

  useEffect(() => {
    setIsClient(true);
    setModifications([
      { id: crypto.randomUUID(), name: 'Oat Milk', default: false },
    ]);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setErrors(null);
    
    if (!firestore || !cafeId) {
      toast({ variant: "destructive", title: "Error", description: "Could not connect to database." });
      setIsPending(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const validatedFields = AddDrinkSchema.safeParse({
      name: formData.get('name'),
      description: formData.get('description'),
      category: formData.get('category'),
      modifications: modifications,
    });

    if (!validatedFields.success) {
      setErrors(validatedFields.error.flatten());
      setIsPending(false);
      return;
    }

    try {
      const drinks = drinksCol(firestore, cafeId);
      // Deletes never renumber, so `count` collides with an existing order and
      // makes the sort unstable. Take one past the current maximum instead.
      const newOrder = menu.reduce((max, item) => Math.max(max, item.order ?? 0), -1) + 1;

      await addDoc(drinks, {
        name: validatedFields.data.name,
        description: validatedFields.data.description,
        category: validatedFields.data.category,
        inStock: true,
        modifications: validatedFields.data.modifications,
        order: newOrder
      });
      toast({ title: "Drink Added!", description: `"${validatedFields.data.name}" added to the menu.` });
      formRef.current?.reset();
      setModifications([{ id: crypto.randomUUID(), name: 'Oat Milk', default: false }]);
      onAdded?.();
    } catch (e: any) {
      console.error("Failed to add drink:", e);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not add drink. You may not have permission."
      });
    } finally {
      setIsPending(false);
    }
  };

  if (!isClient) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} ref={formRef}>
        <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-xl">Drink Name</Label>
                        <Input id="name" name="name" placeholder="e.g. Iced Caramel Macchiato" required className="text-2xl h-14"/>
                        {errors?.fieldErrors.name && (
                            <p className="text-destructive text-lg flex items-center gap-2 pt-1">
                                <AlertCircle className="h-5 w-5" /> {errors.fieldErrors.name[0]}
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="category" className="text-xl">Category</Label>
                        <Select name="category" required>
                            <SelectTrigger className="text-2xl h-14" id="category">
                                <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => (
                                    <SelectItem key={cat.id} value={cat.name} className="text-xl">
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors?.fieldErrors.category && (
                            <p className="text-destructive text-lg flex items-center gap-2 pt-1">
                                <AlertCircle className="h-5 w-5" /> {errors.fieldErrors.category[0]}
                            </p>
                        )}
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="description" className="text-xl">Description</Label>
                    <Textarea id="description" name="description" placeholder="A brief, enticing description for the menu." required className="text-xl min-h-[100px]"/>
                    {errors?.fieldErrors.description && (
                        <p className="text-destructive text-lg flex items-center gap-2 pt-1">
                            <AlertCircle className="h-5 w-5" /> {errors.fieldErrors.description[0]}
                        </p>
                    )}
                </div>
                <ModificationEditor
                  modifications={modifications}
                  onChange={setModifications}
                  label="Modification Options"
                  labelClassName="text-xl"
                  addLabel="Add Modification"
                >
                  {errors?.fieldErrors.modifications && (
                    <p className="text-destructive text-lg flex items-center gap-2 pt-1">
                      <AlertCircle className="h-5 w-5" /> One or more modifications are invalid.
                    </p>
                  )}
                </ModificationEditor>

                <div className="flex justify-end">
                    <Button type="submit" disabled={isPending} className="w-full sm:w-auto text-xl py-6 px-8">
                    {isPending ? 'Adding...' : 'Add Drink'}
                    </Button>
                </div>
        </div>
    </form>
  );
}

/**
 * Add Drink lives behind a dialog so the menu page isn't carrying a permanently
 * open form below the list.
 */
export function AddDrinkDialog({
  categories,
  menu,
  children,
}: {
  categories: Category[];
  menu: MenuItem[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl">Add a new drink</DialogTitle>
          <DialogDescription className="text-lg">
            It appears on the customer menu straight away, in the category you pick.
          </DialogDescription>
        </DialogHeader>
        <AddDrinkForm categories={categories} menu={menu} onAdded={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
