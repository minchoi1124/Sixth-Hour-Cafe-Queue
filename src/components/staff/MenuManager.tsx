
'use client';

import type { MenuItem, Category } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useFirestore, useCafeId } from '@/firebase';
import { writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import { drinkDoc } from '@/lib/cafe-paths';
import {
  ArrowDown, ArrowUp, Trash2, Cloud, Check, Loader2, AlertCircle,
  ChevronDown, ChevronRight, Search, X, Plus, Tags,
} from 'lucide-react';
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
import { ModificationEditor } from '@/components/staff/ModificationEditor';
import { AddDrinkDialog } from '@/components/staff/AddDrinkForm';
import { ManageCategoriesDialog } from '@/components/staff/CategoryManager';
import { cn } from '@/lib/utils';

/**
 * Section key for drinks whose category has no matching Category document.
 * Deleting a category orphans its drinks rather than reassigning them, and those
 * drinks must stay reachable. Real categories are keyed `cat:<name>`, so this
 * cannot collide with a category someone happens to name "Uncategorized".
 */
const ORPHAN_KEY = 'orphan';
const categoryKey = (name: string) => `cat:${name}`;

type StockFilter = 'all' | 'in' | 'out';

type Section = { key: string; label: string; items: MenuItem[] };

/** Which section a drink belongs to, given the categories that actually exist. */
function sectionKeyFor(item: MenuItem, known: Set<string>): string {
  return item.category && known.has(item.category) ? categoryKey(item.category) : ORPHAN_KEY;
}

/**
 * Group drinks into category sections.
 *
 * Section order follows first appearance in the `order`-sorted menu — the same
 * rule the customer page uses (OrderForm builds its sections by reducing over
 * the ordered menu), so this page previews what customers actually see. Sorting
 * alphabetically instead would quietly disagree with the order page.
 */
function groupByCategory(menu: MenuItem[], categories: Category[]): Section[] {
  const known = new Set(categories.map((c) => c.name));
  const bucket = new Map<string, MenuItem[]>();
  const labels = new Map<string, string>();
  const seen: string[] = [];

  for (const item of menu) {
    const key = sectionKeyFor(item, known);
    if (!bucket.has(key)) {
      bucket.set(key, []);
      labels.set(key, key === ORPHAN_KEY ? 'Uncategorized' : item.category);
      seen.push(key);
    }
    bucket.get(key)!.push(item);
  }

  const sections = seen
    .filter((key) => key !== ORPHAN_KEY)
    .map((key) => ({ key, label: labels.get(key)!, items: bucket.get(key)! }));

  // Orphans last, so the working menu reads first.
  if (bucket.has(ORPHAN_KEY)) {
    sections.push({ key: ORPHAN_KEY, label: 'Uncategorized', items: bucket.get(ORPHAN_KEY)! });
  }
  return sections;
}

function SavingStatus({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  return (
    <div className="flex items-center gap-3 text-lg font-medium text-muted-foreground">
      {status === 'saving' && (
        <>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span>Saving changes...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="h-5 w-5 text-green-500" />
          <span className="text-green-600 dark:text-green-400 font-semibold">All changes saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="h-5 w-5 text-destructive" />
          <span className="text-destructive font-semibold">Failed to save. Check connection</span>
        </>
      )}
      {status === 'idle' && (
        <>
          <Cloud className="h-5 w-5 text-muted-foreground/60" />
          <span>Changes autosave to cloud</span>
        </>
      )}
    </div>
  );
}

export default function MenuManager({ menu, categories }: { menu: MenuItem[], categories: Category[] }) {
  const firestore = useFirestore();
  const cafeId = useCafeId();
  const [localMenu, setLocalMenu] = useState<MenuItem[]>([]);
  const [pendingSaveIds, setPendingSaveIds] = useState<Set<string>>(new Set());
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // --- Browsing state ---
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  // One drink open at a time: expanding a second collapses the first, which is
  // the point of the change. Pending autosaves live on a ref at this level, so
  // collapsing a row never drops an in-flight save.
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      if (!firestore || !cafeId) return;
      try {
        const docRef = drinkDoc(firestore, cafeId, item.id);
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

    if (!firestore || !cafeId) return;
    setSavingStatus('saving');
    try {
      await updateDoc(drinkDoc(firestore, cafeId, id), { [field]: checked });
      setSavingStatus('saved');
    } catch (e) {
      console.error("Failed to update stock status:", e);
      setSavingStatus('error');
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update stock status.' });
    }
  };

  /**
   * Swap a drink with its neighbour in the same category.
   *
   * Keyed by id rather than by rendered index on purpose: the list is now
   * grouped and filterable, so a rendered index no longer matches `localMenu`
   * and passing one would swap the wrong two drinks.
   */
  const handleMove = async (itemId: string, direction: 'up' | 'down') => {
    if (!firestore || !cafeId) return;

    const item = localMenu.find(i => i.id === itemId);
    if (!item) return;

    const known = new Set(categories.map(c => c.name));
    const key = sectionKeyFor(item, known);
    const siblings = localMenu.filter(i => sectionKeyFor(i, known) === key);

    const index = siblings.findIndex(i => i.id === itemId);
    const target = siblings[direction === 'up' ? index - 1 : index + 1];
    if (!target) return;

    setSavingStatus('saving');

    const swappedOrder = target.order;
    setLocalMenu(current =>
      current
        .map(i => {
          if (i.id === item.id) return { ...i, order: swappedOrder };
          if (i.id === target.id) return { ...i, order: item.order };
          return i;
        })
        .sort((a, b) => a.order - b.order)
    );

    try {
      const batch = writeBatch(firestore);
      batch.update(drinkDoc(firestore, cafeId, item.id), { order: swappedOrder });
      batch.update(drinkDoc(firestore, cafeId, target.id), { order: item.order });
      await batch.commit();
      setSavingStatus('saved');
    } catch (e) {
      console.error("Failed to reorder menu items:", e);
      setSavingStatus('error');
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save reordered items.' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!firestore || !cafeId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database connection failed.' });
      return;
    }

    setLocalMenu(currentMenu => currentMenu.filter(item => item.id !== id));

    try {
      await deleteDoc(drinkDoc(firestore, cafeId, id));
      toast({ title: 'Drink Deleted', description: `"${name}" has been removed from the menu.` });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Delete Failed', description: 'You may not have permission. Please refresh.' });
    }
  };

  // --- Derived view ---
  const query = search.trim().toLowerCase();
  const isFiltering = query.length > 0 || stockFilter !== 'all';

  const allSections = useMemo(
    () => groupByCategory(localMenu, categories),
    [localMenu, categories],
  );

  const visibleSections = useMemo(() => {
    const matches = (item: MenuItem) => {
      if (stockFilter === 'in' && !item.inStock) return false;
      if (stockFilter === 'out' && item.inStock) return false;
      if (!query) return true;
      return Boolean(
        item.name?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query)
      );
    };
    return allSections
      .map(section => ({ ...section, items: section.items.filter(matches) }))
      .filter(section => section.items.length > 0);
  }, [allSections, query, stockFilter]);

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalVisible = visibleSections.reduce((n, s) => n + s.items.length, 0);

  return (
    <div className="space-y-6">
      {/* Deliberately not sticky: the staff layout already has a sticky header,
          and stacking a second bar under it needs a hardcoded offset that breaks
          whenever the header's height changes. The list is short enough now. */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search drinks..."
                aria-label="Search drinks"
                className="h-12 pl-11 pr-10 text-xl"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex rounded-md border p-1">
              {([
                { value: 'all', label: 'All' },
                { value: 'in', label: 'In stock' },
                { value: 'out', label: 'Out' },
              ] as { value: StockFilter; label: string }[]).map(option => (
                <Button
                  key={option.value}
                  variant={stockFilter === option.value ? 'secondary' : 'ghost'}
                  onClick={() => setStockFilter(option.value)}
                  className="h-10 px-4 text-lg"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ManageCategoriesDialog categories={categories}>
              <Button variant="outline" className="h-12 text-lg">
                <Tags className="mr-2 h-5 w-5" />
                Categories
              </Button>
            </ManageCategoriesDialog>
            <AddDrinkDialog categories={categories} menu={localMenu}>
              <Button className="h-12 text-lg">
                <Plus className="mr-2 h-5 w-5" />
                Add Drink
              </Button>
            </AddDrinkDialog>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SavingStatus status={savingStatus} />
        {isFiltering && (
          <span className="text-lg text-muted-foreground">
            Showing {totalVisible} of {localMenu.length} drinks
          </span>
        )}
      </div>

      {localMenu.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-2xl font-medium">No drinks yet</p>
            <p className="mt-2 text-xl text-muted-foreground">
              Add your first drink to build the menu customers see.
            </p>
          </CardContent>
        </Card>
      ) : visibleSections.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-2xl font-medium">No drinks match</p>
            <p className="mt-2 text-xl text-muted-foreground">
              Try a different search, or clear the filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {visibleSections.map(section => {
            // A filter implies the reader wants to see what matched, so an
            // explicitly collapsed section still opens while filtering.
            const isOpen = isFiltering || !collapsedSections.has(section.key);
            const sectionItems = allSections.find(s => s.key === section.key)?.items ?? [];

            return (
              <Card key={section.key} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-accent/50 sm:px-6"
                  aria-expanded={isOpen}
                >
                  {isOpen
                    ? <ChevronDown className="h-6 w-6 flex-shrink-0 text-muted-foreground" />
                    : <ChevronRight className="h-6 w-6 flex-shrink-0 text-muted-foreground" />}
                  <span className={cn(
                    'text-3xl font-bold',
                    section.key === ORPHAN_KEY && 'text-muted-foreground',
                  )}>
                    {section.label}
                  </span>
                  <span className="text-xl text-muted-foreground">({section.items.length})</span>
                  {section.key === ORPHAN_KEY && (
                    <span className="ml-auto text-base text-muted-foreground">
                      Category was deleted — pick a new one
                    </span>
                  )}
                </button>

                {isOpen && (
                  <div className="divide-y divide-border border-t">
                    {section.items.map(item => {
                      const isExpanded = expandedId === item.id;
                      const position = sectionItems.findIndex(i => i.id === item.id);
                      const modCount = item.modifications?.length ?? 0;

                      return (
                        <div key={item.id}>
                          {/* Compact row. The stock switch lives here on purpose:
                              it's the most frequent action and needs no expand. */}
                          <div className={cn(
                            'flex items-center gap-3 px-4 py-3 sm:px-6',
                            isExpanded && 'bg-accent/40',
                          )}>
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : item.id)}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                              aria-expanded={isExpanded}
                            >
                              {isExpanded
                                ? <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                                : <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />}
                              <span className={cn(
                                'truncate text-2xl',
                                !item.inStock && 'text-muted-foreground line-through',
                              )}>
                                {item.name || 'Untitled drink'}
                              </span>
                              {modCount > 0 && (
                                <span className="hidden flex-shrink-0 text-base text-muted-foreground sm:inline">
                                  {modCount} option{modCount === 1 ? '' : 's'}
                                </span>
                              )}
                            </button>

                            <div className="flex flex-shrink-0 items-center gap-2">
                              <Label htmlFor={`row-${item.id}-instock`} className="hidden text-base text-muted-foreground sm:inline">
                                {item.inStock ? 'In stock' : 'Out'}
                              </Label>
                              <Switch
                                id={`row-${item.id}-instock`}
                                checked={item.inStock}
                                onCheckedChange={(checked) => handleSwitchChange(item.id, 'inStock', checked)}
                                className="data-[state=checked]:bg-green-500 scale-110"
                              />
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="grid grid-cols-1 gap-6 border-t bg-accent/20 px-4 py-6 sm:px-6">
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
                                    onChange={(newMods) => handleInputChange(item.id, 'modifications', newMods)}
                                  />
                                </div>

                                {/* Controls */}
                                <div className="md:col-span-3 flex items-center justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleMove(item.id, 'up')}
                                    disabled={isFiltering || position <= 0}
                                    title={isFiltering ? 'Clear the search and filters to reorder' : 'Move up'}
                                  >
                                    <ArrowUp className="h-6 w-6" />
                                    <span className="sr-only">Move Up</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleMove(item.id, 'down')}
                                    disabled={isFiltering || position === sectionItems.length - 1}
                                    title={isFiltering ? 'Clear the search and filters to reorder' : 'Move down'}
                                  >
                                    <ArrowDown className="h-6 w-6" />
                                    <span className="sr-only">Move Down</span>
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="destructive" size="icon">
                                        <Trash2 className="h-6 w-6" />
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
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
