'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { Category } from '@/lib/definitions';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { z } from 'zod';

const AddDrinkSchema = z.object({
  name: z.string().trim().min(2, 'Drink name must be at least 2 characters'),
  category: z.string().trim().min(1, 'Please select a category'),
});

export function AddDrinkForm({ categories }: { categories: Category[] }) {
  const firestore = useFirestore();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, setIsPending] = useState(false);
  const [errors, setErrors] = useState<{ name?: string[], category?: string[] } | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setErrors(null);
    
    if (!firestore) {
      toast({ variant: "destructive", title: "Error", description: "Could not connect to database." });
      setIsPending(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const validatedFields = AddDrinkSchema.safeParse({
      name: formData.get('name'),
      category: formData.get('category'),
    });

    if (!validatedFields.success) {
      setErrors(validatedFields.error.flatten().fieldErrors);
      setIsPending(false);
      return;
    }

    try {
      const drinksCol = collection(firestore, 'drinks');
      await addDoc(drinksCol, { 
        name: validatedFields.data.name,
        category: validatedFields.data.category,
        inStock: true
      });
      toast({ title: "Drink Added!", description: `"${validatedFields.data.name}" added to the menu.` });
      formRef.current?.reset();
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
        <Card>
            <CardContent className="pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-xl">Drink Name</Label>
                        <Input id="name" name="name" placeholder="e.g. Iced Caramel Macchiato" required className="text-2xl h-14"/>
                        {errors?.name && (
                            <p className="text-destructive text-lg flex items-center gap-2 pt-1">
                                <AlertCircle className="h-5 w-5" /> {errors.name[0]}
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
                        {errors?.category && (
                            <p className="text-destructive text-lg flex items-center gap-2 pt-1">
                                <AlertCircle className="h-5 w-5" /> {errors.category[0]}
                            </p>
                        )}
                    </div>
                    <div className="sm:mt-8 sm:justify-self-end">
                      <Button type="submit" disabled={isPending} className="w-full sm:w-auto text-xl py-6 px-8">
                        {isPending ? 'Adding...' : 'Add Drink'}
                      </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    </form>
  );
}