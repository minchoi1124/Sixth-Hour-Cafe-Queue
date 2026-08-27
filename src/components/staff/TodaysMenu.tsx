'use client';

import { useState } from 'react';
import { useFirestore } from '@/firebase';
import { toast } from '@/hooks/use-toast';
import type { MenuItem, MenuPreset, Session } from '@/lib/definitions';
import { setSessionMenu, toggleSoldOut } from '@/lib/sessions';
import { resolveMenu, savePresetFromSession } from '@/lib/presets';
import { MenuPicker } from '@/components/staff/MenuPicker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Pencil, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * What's being served right now, with a one-tap sold-out toggle per drink.
 *
 * The toggle is the mid-rush action that replaced the old per-drink In Stock
 * switch. Availability is stored on the session, so running out tonight has no
 * effect on next week's service.
 */
export function TodaysMenu({
  cafeId,
  session,
  library,
  presets,
}: {
  cafeId: string;
  session: Session;
  library: MenuItem[];
  presets: MenuPreset[];
}) {
  const firestore = useFirestore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const menuIds = session.menuIds ?? [];
  const soldOutIds = session.soldOutIds ?? [];
  const drinks = resolveMenu(library, menuIds);
  const soldOut = new Set(soldOutIds);

  const preset = session.presetId ? presets.find((p) => p.id === session.presetId) ?? null : null;
  // Only worth offering the write-back when the menu has actually drifted.
  const differsFromPreset =
    preset !== null &&
    (preset.drinkIds ?? []).join(',') !== menuIds.join(',');

  const handleToggle = async (drinkId: string, nowSoldOut: boolean) => {
    if (!firestore) return;
    setBusyId(drinkId);
    try {
      await toggleSoldOut(firestore, cafeId, session.id, menuIds, soldOutIds, drinkId, nowSoldOut);
    } catch (e) {
      console.error('Failed to update availability:', e);
      toast({
        variant: 'destructive',
        title: 'Could not update',
        description: 'Please try again.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = () => {
    setDraftIds(menuIds);
    setEditOpen(true);
  };

  const handleSaveMenu = async () => {
    if (!firestore || draftIds.length === 0) return;
    setIsSaving(true);
    try {
      await setSessionMenu(firestore, cafeId, session.id, draftIds, soldOutIds);
      setEditOpen(false);
      toast({
        title: 'Menu updated',
        description: preset
          ? `"${preset.name}" is unchanged — use Save to preset if you want to keep this.`
          : 'This session only.',
      });
    } catch (e) {
      console.error('Failed to update menu:', e);
      toast({ variant: 'destructive', title: 'Could not update', description: 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToPreset = async () => {
    if (!firestore || !preset) return;
    try {
      await savePresetFromSession(firestore, cafeId, preset.id, menuIds);
      toast({ title: 'Preset updated', description: `"${preset.name}" now matches today's menu.` });
    } catch (e) {
      console.error('Failed to save preset:', e);
      toast({ variant: 'destructive', title: 'Could not save', description: 'Please try again.' });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="text-2xl">
          Today&apos;s menu
          <span className="ml-2 text-lg font-normal text-muted-foreground">
            ({drinks.length})
          </span>
        </CardTitle>
        <div className="flex items-center gap-2">
          {differsFromPreset && (
            <Button variant="outline" onClick={handleSaveToPreset} className="text-base">
              <Save className="mr-2 h-4 w-4" />
              Save to preset
            </Button>
          )}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={openEdit} className="text-base">
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-3xl">Edit today&apos;s menu</DialogTitle>
                <DialogDescription className="text-lg">
                  Changes apply to this session only. The preset it came from stays as it is.
                </DialogDescription>
              </DialogHeader>
              <MenuPicker library={library} selectedIds={draftIds} onChange={setDraftIds} />
              <DialogFooter>
                <Button
                  onClick={handleSaveMenu}
                  disabled={draftIds.length === 0 || isSaving}
                  className="text-lg"
                >
                  {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save menu'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {drinks.length === 0 ? (
          <p className="py-6 text-center text-lg text-muted-foreground">
            No drinks on the menu. Customers can&apos;t order anything — use Edit to add some.
          </p>
        ) : (
          <ul className="divide-y">
            {drinks.map((drink) => {
              const isSoldOut = soldOut.has(drink.id);
              return (
                <li key={drink.id} className="flex items-center gap-3 py-2">
                  <span className={cn(
                    'min-w-0 flex-1 truncate text-xl',
                    isSoldOut && 'text-muted-foreground line-through',
                  )}>
                    {drink.name}
                  </span>
                  <Label htmlFor={`soldout-${drink.id}`} className="text-base text-muted-foreground">
                    {isSoldOut ? 'Out of stock' : 'In stock'}
                  </Label>
                  <Switch
                    id={`soldout-${drink.id}`}
                    checked={!isSoldOut}
                    disabled={busyId === drink.id}
                    onCheckedChange={(available) => handleToggle(drink.id, !available)}
                    className="scale-110 data-[state=checked]:bg-green-500"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
