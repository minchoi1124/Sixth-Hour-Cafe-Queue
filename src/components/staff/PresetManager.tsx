'use client';

import { useState } from 'react';
import { useFirestore, useCafeId } from '@/firebase';
import { toast } from '@/hooks/use-toast';
import type { MenuItem, MenuPreset } from '@/lib/definitions';
import {
  createPreset,
  deletePreset,
  missingDrinkIds,
  renamePreset,
  resolveMenu,
  sortPresets,
  updatePresetDrinks,
} from '@/lib/presets';
import { MenuPicker } from '@/components/staff/MenuPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';

/**
 * Create and edit named menus.
 *
 * Editing a preset never affects a session that already started — sessions
 * snapshot `menuIds` at start precisely so past service records stay accurate.
 */
export function PresetManager({
  library,
  presets,
}: {
  library: MenuItem[];
  presets: MenuPreset[];
}) {
  const firestore = useFirestore();
  const cafeId = useCafeId();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const ordered = sortPresets(presets);
  const editing = editingId ? presets.find((p) => p.id === editingId) ?? null : null;
  const isEditing = isCreating || editing !== null;

  const openCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setDraftName('');
    setDraftIds([]);
  };

  const openEdit = (preset: MenuPreset) => {
    setIsCreating(false);
    setEditingId(preset.id);
    setDraftName(preset.name);
    setDraftIds(preset.drinkIds ?? []);
  };

  const closeEditor = () => {
    setIsCreating(false);
    setEditingId(null);
  };

  const canSave = draftName.trim().length > 0 && draftIds.length > 0 && !isSaving;

  const handleSave = async () => {
    if (!firestore || !cafeId || !canSave) return;
    setIsSaving(true);
    try {
      if (isCreating) {
        await createPreset(firestore, cafeId, draftName, draftIds);
        toast({ title: 'Preset created', description: `"${draftName.trim()}" is ready to use.` });
      } else if (editing) {
        if (draftName.trim() !== editing.name) {
          await renamePreset(firestore, cafeId, editing.id, draftName);
        }
        await updatePresetDrinks(firestore, cafeId, editing.id, draftIds);
        toast({
          title: 'Preset saved',
          description: 'Sessions already running keep the menu they started with.',
        });
      }
      closeEditor();
    } catch (e) {
      console.error('Failed to save preset:', e);
      toast({ variant: 'destructive', title: 'Could not save', description: 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (preset: MenuPreset) => {
    if (!firestore || !cafeId) return;
    try {
      await deletePreset(firestore, cafeId, preset.id);
      toast({ title: 'Preset deleted', description: `"${preset.name}" was removed.` });
    } catch (e) {
      console.error('Failed to delete preset:', e);
      toast({ variant: 'destructive', title: 'Could not delete', description: 'Please try again.' });
    }
  };

  if (isEditing) {
    return (
      <div className="space-y-5">
        <Button variant="ghost" onClick={closeEditor} className="-ml-2 text-lg">
          <ArrowLeft className="mr-2 h-5 w-5" />
          All presets
        </Button>

        <div className="space-y-2">
          <Label htmlFor="preset-name" className="text-lg">Name</Label>
          <Input
            id="preset-name"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="e.g. Fall Menu"
            className="h-12 text-xl"
          />
        </div>

        <MenuPicker library={library} selectedIds={draftIds} onChange={setDraftIds} />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={closeEditor} className="text-lg">Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave} className="text-lg">
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save preset'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button onClick={openCreate} className="text-lg">
        <Plus className="mr-2 h-5 w-5" />
        New preset
      </Button>

      {ordered.length === 0 ? (
        <div className="rounded-md border border-dashed py-12 text-center">
          <p className="text-xl font-medium">No presets yet</p>
          <p className="mt-1 text-lg text-muted-foreground">
            A preset is a named menu you can reuse each session.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {ordered.map((preset) => {
            const drinks = resolveMenu(library, preset.drinkIds);
            const missing = missingDrinkIds(library, preset.drinkIds);
            return (
              <li key={preset.id} className="flex items-start justify-between gap-3 p-4">
                <button
                  type="button"
                  onClick={() => openEdit(preset)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="text-xl font-medium">{preset.name}</span>
                  <p className="mt-1 truncate text-base text-muted-foreground">
                    {drinks.length === 0
                      ? 'No drinks'
                      : drinks.map((d) => d.name).join(', ')}
                  </p>
                  {missing.length > 0 && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      {missing.length} deleted drink{missing.length === 1 ? '' : 's'} skipped
                    </Badge>
                  )}
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${preset.name}`}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete &quot;{preset.name}&quot;?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The drinks stay in your library, and sessions that already used this
                        preset keep their menus. Only the preset itself is removed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(preset)} variant="destructive">
                        Yes, delete preset
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Preset management behind a dialog, opened from the library toolbar. */
export function ManagePresetsDialog({
  library,
  presets,
  children,
}: {
  library: MenuItem[];
  presets: MenuPreset[];
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl">Menu presets</DialogTitle>
          <DialogDescription className="text-lg">
            Named menus you can pick from when starting a session. Editing one never
            changes a session that already started.
          </DialogDescription>
        </DialogHeader>
        <PresetManager library={library} presets={presets} />
      </DialogContent>
    </Dialog>
  );
}
