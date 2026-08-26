'use client';

import type { Modification } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PlusCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Editor for a drink's modification options.
 *
 * Shared by MenuManager (editing an existing drink, autosaved) and AddDrinkForm
 * (composing a new one), which previously carried verbatim copies of this
 * markup. The labels differ slightly between the two, so they're props.
 */
export function ModificationEditor({
  modifications,
  onChange,
  label = 'Modifications',
  labelClassName = 'text-lg text-muted-foreground',
  addLabel = 'Add Option',
  children,
}: {
  modifications: Modification[];
  onChange: (next: Modification[]) => void;
  label?: string;
  labelClassName?: string;
  addLabel?: string;
  /** Rendered inside the bordered box, below the list — used for validation errors. */
  children?: React.ReactNode;
}) {
  const safeModifications = modifications ?? [];

  const handleAdd = () => {
    onChange([...safeModifications, { id: crypto.randomUUID(), name: '', default: false }]);
  };

  const handleRemove = (id: string) => {
    onChange(safeModifications.filter((mod) => mod.id !== id));
  };

  const handleChange = (id: string, field: 'name' | 'default', value: string | boolean) => {
    onChange(safeModifications.map((mod) => (mod.id === id ? { ...mod, [field]: value } : mod)));
  };

  return (
    <div className="space-y-4">
      <Label className={cn(labelClassName)}>{label}</Label>
      <div className="space-y-3 rounded-md border p-4">
        {safeModifications.map((mod) => (
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
        {children}
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <PlusCircle className="mr-2 h-4 w-4" /> {addLabel}
        </Button>
      </div>
    </div>
  );
}
