
'use client';

import type { MenuItem, Category, Modification } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { useState, useEffect, useRef } from 'react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useFirestore } from '@/firebase';
import { doc, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { ArrowDown, ArrowUp, PlusCircle, Trash2, Cloud, Check, Loader2, AlertCircle } from 'lucide-react';
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

function ModificationEditor({ modifications, onModificationChange }: { modifications: Modification[], onModificationChange: (newMods: Modification[]) => void }) {
  const safeModifications = modifications ?? [];
  
  const handleAdd = () => {
    onModificationChange([...safeModifications, { id: crypto.randomUUID(), name: '', default: false }]);
  };

  const handleRemove = (id: string) => {
    onModificationChange(safeModifications.filter(mod => mod.id !== id));
  };

  const handleChange = (id: string, field: 'name' | 'default', value: string | boolean) => {
    onModificationChange(safeModifications.map(mod => mod.id === id ? { ...mod, [field]: value } : mod));
  };

  return (
    <div className="space-y-4">
      <Label className="text-lg text-muted-foreground">Modifications</Label>
      <div className="space-y-3 rounded-md border p-4">
        {safeModifications.map(mod => (
          <div key={mod.id} className="flex items-center gap-4">
            <Input
              value={mod.name}
              onChange={(e) => handleChange(mod.id, 'name', e.target.value)}
              placeholder="e.g., Extra Shot"
              className="text-xl h-12 flex-grow"
            />
            <div className="flex items-center space-x-2">
              <Switch
                id={`mod-default-${mod.id}`}
                checked={mod.default}
                onCheckedChange={(checked) => handleChange(mod.id, 'default', checked)}
              />
              <Label htmlFor={`mod-default-${mod.id}`} className="text-lg">Default</Label>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemove(mod.id)}>
              <Trash2 className="h-5 w-5 text-destructive" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add Option
        </Button>
      </div>
    </div>
  );
}


export default function MenuManager({ menu, categories }: { menu: MenuItem[], categories: Category[] }) {
  const firestore = useFirestore();
  const [localMenu, setLocalMenu] = useState<MenuItem[]>([]);
  const [pendingSaveIds, setPendingSaveIds] = useState<Set<string>>(new Set());
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  
  const saveTimeoutRefs = useRef<{ [key: string]: NodeJS.Timeout }>({});

  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(saveTimeoutRefs.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    setLocalMenu(currentMenu => {
      const localMap = new Map(currentMenu.map(item => [item.id, item]));
      const mergedMenu = menu.map(item => {
        if (pendingSaveIds.has(item.id)) {
          return localMap.get(item.id) || item;
        }
        return item;
      });
      return mergedMenu.sort((a, b) => a.order - b.order);
    });
  }, [menu, pendingSaveIds]);

  const triggerAutoSave = (item: MenuItem) => {
    setPendingSaveIds(prev => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    setSavingStatus('saving');

    if (saveTimeoutRefs.current[item.id]) {
      clearTimeout(saveTimeoutRefs.current[item.id]);
    }

    saveTimeoutRefs.current[item.id] = setTimeout(async () => {
      if (!firestore) return;
      try {
        const docRef = doc(firestore, 'drinks', item.id);
        const { id, ...data } = item;
        await updateDoc(docRef, data);
        
        setPendingSaveIds(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });

        delete saveTimeoutRefs.current[item.id];
        if (Object.keys(saveTimeoutRefs.current).length === 0) {
          setSavingStatus('saved');
        }
      } catch (error) {
        console.error("Auto-save failed:", error);
        setSavingStatus('error');
        toast({
          variant: 'destructive',
          title: 'Auto-save Failed',
          description: `Could not save changes to "${item.name}".`,
        });
      }
    }, 1000);
  };

  const handleInputChange = (id: string, field: 'name' | 'category' | 'description' | 'modifications', value: any) => {
    setLocalMenu(currentMenu => {
      return currentMenu.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          triggerAutoSave(updatedItem);
          return updatedItem;
        }
        return item;
      });
    });
  };

  const handleSwitchChange = async (id: string, field: 'inStock', checked: boolean) => {
    setLocalMenu(currentMenu => 
      currentMenu.map(item => item.id === id ? { ...item, [field]: checked } : item)
    );

    if (!firestore) return;
    setSavingStatus('saving');
    try {
      await updateDoc(doc(firestore, 'drinks', id), { [field]: checked });
      setSavingStatus('saved');
    } catch (e) {
      console.error("Failed to update stock status:", e);
      setSavingStatus('error');
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update stock status.' });
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (!firestore) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= localMenu.length) {
      return;
    }
    
    setSavingStatus('saving');

    const newMenu = [...localMenu];
    const item1 = { ...newMenu[index] };
    const item2 = { ...newMenu[targetIndex] };

    const tempOrder = item1.order;
    item1.order = item2.order;
    item2.order = tempOrder;

    newMenu[index] = item2;
    newMenu[targetIndex] = item1;
    setLocalMenu(newMenu.sort((a, b) => a.order - b.order));

    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'drinks', item1.id), { order: item1.order });
      batch.update(doc(firestore, 'drinks', item2.id), { order: item2.order });
      await batch.commit();
      setSavingStatus('saved');
    } catch (e) {
      console.error("Failed to reorder menu items:", e);
      setSavingStatus('error');
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save reordered items.' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database connection failed.' });
      return;
    }
    
    setLocalMenu(currentMenu => currentMenu.filter(item => item.id !== id));

    try {
      await deleteDoc(doc(firestore, 'drinks', id));
      toast({ title: 'Drink Deleted', description: `"${name}" has been removed from the menu.` });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Delete Failed', description: 'You may not have permission. Please refresh.' });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3 text-lg font-medium text-muted-foreground">
          {savingStatus === 'saving' && (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span>Saving changes...</span>
            </>
          )}
          {savingStatus === 'saved' && (
            <>
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-green-600 dark:text-green-400 font-semibold">All changes saved</span>
            </>
          )}
          {savingStatus === 'error' && (
            <>
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-destructive font-semibold">Failed to save. Check connection</span>
            </>
          )}
          {savingStatus === 'idle' && (
            <>
              <Cloud className="h-5 w-5 text-muted-foreground/60" />
              <span>Changes autosave to cloud</span>
            </>
          )}
        </div>
      </div>
      <Card>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <div className="divide-y divide-border">
            {localMenu.map((item, index) => (
              <div key={item.id} className="grid grid-cols-1 gap-6 py-6 px-4 sm:px-0">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    {/* Name and Category */}
                    <div className="md:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                          <Label htmlFor={`item-${item.id}-name`} className="text-lg text-muted-foreground">Name</Label>
                          <Input
                              id={`item-${item.id}-name`}
                              value={item.name}
                              onChange={(e) => handleInputChange(item.id, 'name', e.target.value)}
                              className="text-2xl h-14"
                              required
                          />
                      </div>
                      <div>
                          <Label htmlFor={`item-${item.id}-category`} className="text-lg text-muted-foreground">Category</Label>
                          <Select 
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
                    {/* Description */}
                    <div className="md:col-span-7">
                        <Label htmlFor={`item-${item.id}-description`} className="text-lg text-muted-foreground">Description</Label>
                        <Textarea
                            id={`item-${item.id}-description`}
                            value={item.description}
                            onChange={(e) => handleInputChange(item.id, 'description', e.target.value)}
                            className="text-xl min-h-[56px] h-14"
                            placeholder="Enter a short description..."
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pt-4">
                  {/* Modifications */}
                  <div className="md:col-span-9">
                    <ModificationEditor 
                      modifications={item.modifications} 
                      onModificationChange={(newMods) => handleInputChange(item.id, 'modifications', newMods)}
                    />
                  </div>
                  
                  {/* Controls */}
                  <div className="md:col-span-3 flex md:flex-col items-center md:items-end justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center gap-2">
                            <Label htmlFor={`item-${item.id}-instock`} className="text-lg">
                                In Stock
                            </Label>
                            <Switch
                                id={`item-${item.id}-instock`}
                                checked={item.inStock}
                                onCheckedChange={(checked) => handleSwitchChange(item.id, 'inStock', checked)}
                                className="data-[state=checked]:bg-green-500 scale-110"
                            />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
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
                                  This will permanently delete the drink &quot;{item.name}&quot; from the menu.
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
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
