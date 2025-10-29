'use client';

import type { MenuItem, Category } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { useState, useTransition, useEffect } from 'react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useFirestore } from '@/firebase';
import { doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
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
import { Textarea } from '../ui/textarea';

export default function MenuManager({ menu, categories }: { menu: MenuItem[], categories: Category[] }) {
  const firestore = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [localMenu, setLocalMenu] = useState<MenuItem[]>([]);

  useEffect(() => {
    // Sort menu by order when it's passed in
    setLocalMenu(menu.sort((a, b) => a.order - b.order));
  }, [menu]);

  const handleInputChange = (id: string, field: 'name' | 'category' | 'description', value: string) => {
    setLocalMenu(currentMenu => 
      currentMenu.map(item => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  const handleSwitchChange = (id: string, checked: boolean) => {
    setLocalMenu(currentMenu => 
      currentMenu.map(item => item.id === id ? { ...item, inStock: checked } : item)
    );
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    setLocalMenu(currentMenu => {
      const newMenu = [...currentMenu];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= newMenu.length) {
        return newMenu; // Can't move
      }

      // Swap the order values of the two items
      const item1 = newMenu[index];
      const item2 = newMenu[targetIndex];
      
      newMenu[index] = { ...item1, order: item2.order };
      newMenu[targetIndex] = { ...item2, order: item1.order };
      
      // Sort the array based on the new order to visually update the list
      return newMenu.sort((a, b) => a.order - b.order);
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database connection failed.' });
      return;
    }
    
    // Optimistically remove from local state
    setLocalMenu(currentMenu => currentMenu.filter(item => item.id !== id));

    try {
      await deleteDoc(doc(firestore, 'drinks', id));
      toast({ title: 'Drink Deleted', description: `"${name}" has been removed from the menu.` });
      // Note: We don't re-add on failure, user can refresh. Or we could...
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Delete Failed', description: 'You may not have permission. Please refresh.' });
      // If delete fails, the optimistic update will be reverted on the next data fetch from Firestore.
    }
  };


  const handleSaveChanges = () => {
    startTransition(async () => {
      if (!firestore) {
        toast({ variant: "destructive", title: "Error", description: "Database not available." });
        return;
      }
      
      const batch = writeBatch(firestore);
      localMenu.forEach((item, index) => {
        const docRef = doc(firestore, 'drinks', item.id);
        const { id, ...data } = item;
        // Re-assign order based on the new array index to ensure it's sequential
        batch.set(docRef, { ...data, order: index });
      });

      try {
        await batch.commit();
        toast({ title: "Menu Updated", description: "The menu has been successfully updated." });
      } catch (e: any) {
        console.error("Failed to save menu:", e);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not save menu. You may not have permission."
        });
      }
    });
  };

  return (
    <div>
      <Card>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <div className="divide-y divide-border">
            {localMenu.map((item, index) => (
              <div key={item.id} className="grid grid-cols-1 gap-6 py-6 px-4 sm:px-0">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-start">
                    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor={`item-${item.id}-name`} className="text-lg text-muted-foreground">Name</Label>
                        <Input
                            id={`item-${item.id}-name`}
                            name={`item-${item.id}-name`}
                            value={item.name}
                            onChange={(e) => handleInputChange(item.id, 'name', e.target.value)}
                            className="text-2xl h-14"
                            required
                        />
                    </div>
                    <div>
                        <Label htmlFor={`item-${item.id}-category`} className="text-lg text-muted-foreground">Category</Label>
                        <Select 
                        name={`item-${item.id}-category`} 
                        value={item.category}
                        onValueChange={(value) => handleInputChange(item.id, 'category', value)}
                        >
                        <SelectTrigger className="text-2xl h-14" id={`item-${item.id}-category`}>
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
                    </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-self-end gap-4 pt-4 sm:pt-9">
                        <Label htmlFor={`item-${item.id}-instock`} className="text-2xl">
                            In Stock
                        </Label>
                        <Switch
                            id={`item-${item.id}-instock`}
                            name={`item-${item.id}-instock`}
                            checked={item.inStock}
                            onCheckedChange={(checked) => handleSwitchChange(item.id, checked)}
                            className="data-[state=checked]:bg-green-500 scale-125"
                        />
                    </div>
                    <div className="flex items-center justify-end gap-2 sm:pt-9">
                        <Button variant="outline" size="icon" onClick={() => handleMove(index, 'up')} disabled={index === 0}>
                            <ArrowUp className="h-6 w-6"/>
                            <span className="sr-only">Move Up</span>
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => handleMove(index, 'down')} disabled={index === localMenu.length - 1}>
                            <ArrowDown className="h-6 w-6"/>
                            <span className="sr-only">Move Down</span>
                        </Button>
                        <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon">
                                <Trash2 className="h-6 w-6"/>
                                <span className="sr-only">Delete</span>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete the drink "{item.name}" from the menu.
                                This action cannot be undone.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(item.id, item.name)} variant="destructive">
                                Yes, delete drink
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
                <div>
                  <Label htmlFor={`item-${item.id}-description`} className="text-lg text-muted-foreground">Description</Label>
                  <Textarea
                    id={`item-${item.id}-description`}
                    value={item.description}
                    onChange={(e) => handleInputChange(item.id, 'description', e.target.value)}
                    className="text-xl min-h-[80px]"
                    placeholder="Enter a short description..."
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="mt-8 flex justify-end">
        <Button onClick={handleSaveChanges} disabled={isPending} className="w-full text-2xl py-7 sm:w-auto sm:px-10">
          {isPending ? 'Saving...' : 'Save All Changes'}
        </Button>
      </div>
    </div>
  );
}
