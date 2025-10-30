'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { AlertCircle, PlusCircle, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { Category, Modification } from '@/lib/definitions';
import { useFirestore } from '@/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { z } from 'zod';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';

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

export function AddDrinkForm({ categories }: { categories: Category[] }) {
  const firestore = useFirestore();
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

  const handleAddModification = () => {
    setModifications([...modifications, { id: crypto.randomUUID(), name: '', default: false }]);
  };

  const handleRemoveModification = (id: string) => {
    setModifications(modifications.filter(mod => mod.id !== id));
  };

  const handleModificationChange = (id: string, field: 'name' | 'default', value: string | boolean) => {
    setModifications(modifications.map(mod => mod.id === id ? { ...mod, [field]: value } : mod));
  };

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
      const drinksCol = collection(firestore, 'drinks');
      const drinksSnapshot = await getDocs(drinksCol);
      const newOrder = drinksSnapshot.size;

      await addDoc(drinksCol, { 
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
            <CardContent className="pt-6 space-y-6">
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
                <div className="space-y-4">
                  <Label className="text-xl">Modification Options</Label>
                  <div className="space-y-4 rounded-md border p-4">
                    {modifications.map((mod, index) => (
                      <div key={mod.id} className="flex items-center gap-4">
                        <Input
                          value={mod.name}
                          onChange={(e) => handleModificationChange(mod.id, 'name', e.target.value)}
                          placeholder="e.g., Extra Shot"
                          className="text-xl h-12 flex-grow"
                        />
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`mod-default-${mod.id}`}
                            checked={mod.default}
                            onCheckedChange={(checked) => handleModificationChange(mod.id, 'default', checked)}
                          />
                          <Label htmlFor={`mod-default-${mod.id}`} className="text-lg">Default</Label>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveModification(mod.id)}>
                          <Trash2 className="h-5 w-5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    {errors?.fieldErrors.modifications && (
                        <p className="text-destructive text-lg flex items-center gap-2 pt-1">
                            <AlertCircle className="h-5 w-5" /> One or more modifications are invalid.
                        </p>
                    )}
                    <Button type="button" variant="outline" onClick={handleAddModification}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Modification
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end">
                    <Button type="submit" disabled={isPending} className="w-full sm:w-auto text-xl py-6 px-8">
                    {isPending ? 'Adding...' : 'Add Drink'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    </form>
  );
}
