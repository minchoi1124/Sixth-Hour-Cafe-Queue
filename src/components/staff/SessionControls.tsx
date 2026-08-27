'use client';

import { useEffect, useState } from 'react';
import { useFirestore } from '@/firebase';
import { toast } from '@/hooks/use-toast';
import type { MenuItem, MenuPreset, Session } from '@/lib/definitions';
import {
  activateSession,
  endSession,
  isScheduledStart,
  startSession,
  toDate,
} from '@/lib/sessions';
import {
  dateToZonedWallTime,
  formatDuration,
  formatSessionDate,
  formatSessionTime,
  zonedWallTimeToDate,
} from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MenuPicker } from '@/components/staff/MenuPicker';
import { createPreset, resolveMenu, sortPresets } from '@/lib/presets';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { CalendarClock, Loader2, MapPin, Play, Square } from 'lucide-react';

/** Select value meaning "build a new preset here" — never a preset id. */
const NEW_PRESET = '__new__';

/** The venue + clock readout for the session currently running. */
export function SessionChip({ session, timezone }: { session: Session; timezone: string }) {
  const startsAt = toDate(session.startsAt);
  // Re-render each minute so the elapsed time stays honest.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!startsAt) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-secondary p-3 text-xl font-medium">
      <MapPin className="h-6 w-6 flex-shrink-0" />
      <div className="leading-tight">
        <div>{session.location}</div>
        <div className="text-base font-normal text-muted-foreground">
          Since {formatSessionTime(startsAt, timezone)} · {formatDuration(startsAt, now)}
        </div>
      </div>
    </div>
  );
}

type StartSessionDialogProps = {
  cafeId: string;
  timezone: string;
  /** Prefill for the venue field — last session's, falling back to the cafe's. */
  defaultLocation: string;
  /** Every drink the cafe has created, to build a menu from. */
  library: MenuItem[];
  /** Saved named menus to choose between. */
  presets: MenuPreset[];
  /** Rendered as the dialog trigger. */
  children: React.ReactNode;
};

/**
 * Collects the new session's venue and start time. The date and time are
 * prefilled to "now" in the cafe's timezone but stay editable, so a session can
 * be planned in advance — a future start is saved as `scheduled` and does not
 * take over as the active session.
 */
export function StartSessionDialog({
  cafeId,
  timezone,
  defaultLocation,
  library,
  presets,
  children,
}: StartSessionDialogProps) {
  const firestore = useFirestore();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [location, setLocation] = useState(defaultLocation);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  // A session must have a menu — either an existing preset or a new one built
  // here. NEW_PRESET is a sentinel for the Select, not a preset id.
  const [presetChoice, setPresetChoice] = useState<string>('');
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetIds, setNewPresetIds] = useState<string[]>([]);

  // Reset the form to "here, now" every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const wall = dateToZonedWallTime(new Date(), timezone);
    setLocation(defaultLocation);
    setDate(wall.date);
    setTime(wall.time);
    setNotes('');
    // Default to the most recently used preset — the common case is running the
    // same menu as last time.
    setPresetChoice(sortPresets(presets)[0]?.id ?? NEW_PRESET);
    setNewPresetName('');
    setNewPresetIds([]);
  }, [open, defaultLocation, timezone, presets]);

  const startsAt = date && time ? zonedWallTimeToDate(date, time, timezone) : null;
  const startsAtValid = !!startsAt && !Number.isNaN(startsAt.getTime());
  // Same rule the write path uses, so the button never promises "Start session"
  // and then save a scheduled one.
  const isScheduled = startsAtValid && isScheduledStart(startsAt);

  const orderedPresets = sortPresets(presets);
  const creatingPreset = presetChoice === NEW_PRESET;
  const chosenPreset = creatingPreset
    ? null
    : presets.find((p) => p.id === presetChoice) ?? null;
  // Resolve through the library so a preset referencing a deleted drink can't
  // put a dead id on the menu.
  const menuIds = creatingPreset
    ? newPresetIds
    : resolveMenu(library, chosenPreset?.drinkIds).map((d) => d.id);

  const menuReady = creatingPreset
    ? newPresetName.trim().length > 0 && newPresetIds.length > 0
    : menuIds.length > 0;

  const canSubmit =
    location.trim().length > 0 && startsAtValid && menuReady && !isSaving;

  const handleSubmit = async () => {
    if (!firestore || !canSubmit || !startsAt) return;
    setIsSaving(true);
    try {
      // Save the new preset first so the session records where its menu came
      // from, and so the menu is reusable next time.
      const presetId = creatingPreset
        ? await createPreset(firestore, cafeId, newPresetName, newPresetIds)
        : chosenPreset?.id ?? null;

      const result = await startSession(firestore, cafeId, {
        location: location.trim(),
        startsAt,
        notes: notes.trim() || undefined,
        menuIds,
        presetId,
      });
      setOpen(false);
      toast({
        title: result.started ? 'Session started' : 'Session scheduled',
        description: result.started
          ? result.adoptedOrders > 0
            ? `Counter reset. ${result.adoptedOrders} unassigned order${result.adoptedOrders === 1 ? '' : 's'} added to this session.`
            : 'The drink counter has been reset.'
          : `Saved for ${formatSessionDate(startsAt, timezone)}. Start it from History when you're ready.`,
      });
    } catch (e) {
      console.error('Failed to start session:', e);
      toast({
        variant: 'destructive',
        title: 'Could not start session',
        description:
          e instanceof Error && e.message.includes('already running')
            ? e.message
            : 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl">Start a new session</DialogTitle>
          <DialogDescription className="text-lg">
            Resets the drink counter. Previous sessions stay in History with their totals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="session-location" className="text-lg">Location</Label>
            <Input
              id="session-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Library 2nd floor"
              className="h-12 text-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="session-date" className="text-lg">Date</Label>
              <Input
                id="session-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-12 text-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-time" className="text-lg">Start time</Label>
              <Input
                id="session-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-12 text-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-notes" className="text-lg">Notes (optional)</Label>
            <Textarea
              id="session-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything worth remembering about this session"
              className="text-lg"
            />
          </div>

          {/* Menu — required. A session with no menu leaves customers nothing
              to order, so submit stays blocked until one is chosen. */}
          <div className="space-y-3 rounded-md border p-4">
            <div className="space-y-2">
              <Label htmlFor="session-preset" className="text-lg">Menu</Label>
              <Select value={presetChoice} onValueChange={setPresetChoice}>
                <SelectTrigger id="session-preset" className="h-12 text-xl">
                  <SelectValue placeholder="Choose a menu" />
                </SelectTrigger>
                <SelectContent>
                  {orderedPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id} className="text-lg">
                      {preset.name} ({resolveMenu(library, preset.drinkIds).length})
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_PRESET} className="text-lg">
                    + New preset...
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {creatingPreset ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="new-preset-name" className="text-lg">Preset name</Label>
                  <Input
                    id="new-preset-name"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    placeholder="e.g. Fall Menu"
                    className="h-12 text-xl"
                  />
                </div>
                <MenuPicker
                  library={library}
                  selectedIds={newPresetIds}
                  onChange={setNewPresetIds}
                />
              </div>
            ) : (
              <p className="text-base text-muted-foreground">
                {menuIds.length === 0
                  ? 'This preset has no drinks left in the library. Pick another or build a new one.'
                  : resolveMenu(library, chosenPreset?.drinkIds).map((d) => d.name).join(', ')}
              </p>
            )}
          </div>

          {isScheduled && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-base text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <CalendarClock className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <span>
                That start time is in the future, so this will be saved as a scheduled session.
                It won&apos;t collect orders until you start it.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="py-6 text-xl">
            {isSaving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isScheduled ? (
              'Schedule session'
            ) : (
              'Start session'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Confirms ending the running session and shows the totals about to be frozen. */
export function EndSessionButton({
  cafeId,
  session,
  drinkCount,
}: {
  cafeId: string;
  session: Session;
  drinkCount: number;
}) {
  const firestore = useFirestore();
  const [isEnding, setIsEnding] = useState(false);

  const handleEnd = async () => {
    if (!firestore) return;
    setIsEnding(true);
    try {
      const stats = await endSession(firestore, cafeId, session.id);
      toast({
        title: 'Session ended',
        description: `${stats.drinkCount} drink${stats.drinkCount === 1 ? '' : 's'} saved to History.`,
      });
    } catch (e) {
      console.error('Failed to end session:', e);
      toast({
        variant: 'destructive',
        title: 'Could not end session',
        description: 'Please try again.',
      });
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={isEnding} className="py-6 text-xl">
          <Square className="mr-2 h-5 w-5" />
          {isEnding ? 'Ending...' : 'End Session'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>End this session?</AlertDialogTitle>
          <AlertDialogDescription>
            {session.location} finishes with <strong>{drinkCount}</strong> drink
            {drinkCount === 1 ? '' : 's'}. That total is saved to History, and the
            counter resets when you start the next session.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleEnd}>End session</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** "Start now" for a session that was planned ahead. */
export function ActivateSessionButton({
  cafeId,
  session,
  disabled,
}: {
  cafeId: string;
  session: Session;
  disabled?: boolean;
}) {
  const firestore = useFirestore();
  const [isStarting, setIsStarting] = useState(false);

  const handleActivate = async () => {
    if (!firestore) return;
    setIsStarting(true);
    try {
      const adopted = await activateSession(firestore, cafeId, session.id);
      toast({
        title: 'Session started',
        description:
          adopted > 0
            ? `${adopted} unassigned order${adopted === 1 ? '' : 's'} added to this session.`
            : 'The drink counter has been reset.',
      });
    } catch (e) {
      console.error('Failed to activate session:', e);
      toast({
        variant: 'destructive',
        title: 'Could not start session',
        description:
          e instanceof Error && e.message.includes('already running')
            ? e.message
            : 'Please try again.',
      });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Button
      variant="secondary"
      onClick={handleActivate}
      disabled={disabled || isStarting}
      title={disabled ? 'End the running session first' : undefined}
    >
      <Play className="mr-2 h-5 w-5" />
      {isStarting ? 'Starting...' : 'Start now'}
    </Button>
  );
}
