'use client';

import { useMemo, useState } from 'react';
import type { MenuItem } from '@/lib/definitions';
import { resolveMenu, sortLibrary } from '@/lib/presets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Pick an ordered set of drinks from the library.
 *
 * Selection order matters — array position becomes the order customers see —
 * so the chosen drinks get their own reorderable list rather than just being
 * ticked in place.
 */
export function MenuPicker({
  library,
  selectedIds,
  onChange,
}: {
  library: MenuItem[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
}) {
  const [search, setSearch] = useState('');

  const sorted = useMemo(() => sortLibrary(library), [library]);
  const query = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return sorted;
    return sorted.filter(
      (item) =>
        item.name?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query),
    );
  }, [sorted, query]);

  const selected = useMemo(() => resolveMenu(library, selectedIds), [library, selectedIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (id: string) => {
    onChange(selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const move = (id: string, direction: 'up' | 'down') => {
    const index = selectedIds.indexOf(id);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Library */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the library..."
            aria-label="Search the drink library"
            className="h-11 pl-10 text-lg"
          />
        </div>

        <div className="max-h-72 overflow-y-auto rounded-md border">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-muted-foreground">
              {library.length === 0 ? 'No drinks in the library yet.' : 'No drinks match.'}
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-accent/50">
                    <Checkbox
                      checked={selectedSet.has(item.id)}
                      onCheckedChange={() => toggle(item.id)}
                      className="h-5 w-5"
                    />
                    <span className="min-w-0 flex-1 truncate text-lg">{item.name}</span>
                    {item.category && (
                      <Badge variant="secondary" className="flex-shrink-0 text-xs">
                        {item.category}
                      </Badge>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Chosen menu, in the order customers will see */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-lg font-medium">
            On the menu ({selected.length})
          </span>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => onChange([])} className="text-base">
              Clear
            </Button>
          )}
        </div>

        <div className={cn(
          'max-h-72 overflow-y-auto rounded-md border',
          selected.length === 0 && 'border-dashed',
        )}>
          {selected.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">
              Nothing selected. Customers would see an empty menu.
            </p>
          ) : (
            <ul className="divide-y">
              {selected.map((item, index) => (
                <li key={item.id} className="flex items-center gap-2 p-2 pl-3">
                  <span className="w-6 flex-shrink-0 text-base text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-lg">{item.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => move(item.id, 'up')}
                    disabled={index === 0}
                    aria-label={`Move ${item.name} up`}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => move(item.id, 'down')}
                    disabled={index === selected.length - 1}
                    aria-label={`Move ${item.name} down`}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => toggle(item.id)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
