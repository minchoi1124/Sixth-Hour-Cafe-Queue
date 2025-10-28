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
import { doc, writeBatch } from 'firebase/firestore';

export default function MenuManager({ menu, categories }: { menu: MenuItem[], categories: Category[] }) {
  const firestore = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [localMenu, setLocalMenu] = useState<MenuItem[]>(menu);

  useEffect(() => {
    setLocalMenu(menu);
  }, [menu]);

  const handleInputChange = (id: string, field: 'name' | 'category', value: string) => {
    setLocalMenu(currentMenu => 
      currentMenu.map(item => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  const handleSwitchChange = (id: string, checked: boolean) => {
    setLocalMenu(currentMenu => 
      currentMenu.map(item => item.id === id ? { ...item, inStock: checked } : item)
    );
  };

  const handleSaveChanges = () => {
    startTransition(async () => {
      if (!firestore) {
        toast({ variant: "destructive", title: "Error", description: "Database not available." });
        return;
      }
      
      const batch = writeBatch(firestore);
      localMenu.forEach(item => {
        const docRef = doc(firestore, 'drinks', item.id);
        const { id, ...data } = item;
        batch.set(docRef, data);
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
            {localMenu.map(item => (
              <div key={item.id} className="grid grid-cols-1 sm:grid-cols-3 items-center gap-4 py-6 px-4 sm:px-0">
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
                <div className="flex items-center justify-between sm:justify-self-end gap-4 pt-4 sm:pt-0 border-t sm:border-t-0 border-border">
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
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="mt-8 flex justify-end">
        <Button onClick={handleSaveChanges} disabled={isPending} className="w-full text-2xl py-7 sm:w-auto sm:px-10">
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
