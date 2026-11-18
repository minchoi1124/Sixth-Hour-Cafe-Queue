'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { updateDoc } from 'firebase/firestore';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCafeRole, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { userDoc } from '@/lib/cafe-paths';
import { LATEST_UPDATE_ID, UPDATES, unseenUpdates } from '@/lib/updates';

const LAST_SEEN_KEY = 'whatsNew.lastSeenUpdate';

/**
 * The newest update a staff device has dismissed. Staff have no account doc,
 * so it's kept on the device. Before a staff phone has dismissed anything it's
 * treated as up to date as of signing in, so a new helper isn't greeted with
 * the whole history.
 */
function useDeviceLastSeen(enabled: boolean) {
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LAST_SEEN_KEY);
      if (!stored) localStorage.setItem(LAST_SEEN_KEY, LATEST_UPDATE_ID);
    } catch {
      // Storage blocked: never auto-open rather than open every visit.
    }
    setLastSeen(stored ?? LATEST_UPDATE_ID);
  }, [enabled]);

  const markSeen = () => {
    try {
      localStorage.setItem(LAST_SEEN_KEY, LATEST_UPDATE_ID);
    } catch {
      // Nothing to do.
    }
    setLastSeen(LATEST_UPDATE_ID);
  };
  return { lastSeen, markSeen };
}

/**
 * Header button for the "What's new" dialog. Opens on its own once when there
 * are updates this owner account (or staff device) hasn't seen, and marks them
 * seen when closed.
 */
export function WhatsNew() {
  const firestore = useFirestore();
  const { user } = useUser();
  const isStaff = useCafeRole() === 'staff';
  const [open, setOpen] = useState(false);
  const autoOpened = useRef(false);

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user || isStaff) return null;
    return userDoc(firestore, user.uid);
  }, [firestore, user, isStaff]);

  const { data: account, isLoading: isAccountLoading } = useDoc<{ lastSeenUpdate?: string }>(userRef);
  const device = useDeviceLastSeen(isStaff);

  const isLoading = isStaff ? device.lastSeen === null : isAccountLoading;
  const unseen = useMemo(() => {
    if (isStaff) return device.lastSeen ? unseenUpdates(device.lastSeen) : [];
    return account ? unseenUpdates(account.lastSeenUpdate) : [];
  }, [isStaff, device.lastSeen, account]);
  const unseenIds = useMemo(() => new Set(unseen.map((update) => update.id)), [unseen]);

  useEffect(() => {
    if (isLoading || autoOpened.current || unseen.length === 0) return;
    autoOpened.current = true;
    setOpen(true);
  }, [isLoading, unseen]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next || unseen.length === 0) return;
    if (isStaff) {
      device.markSeen();
    } else if (userRef) {
      updateDoc(userRef, { lastSeenUpdate: LATEST_UPDATE_ID }).catch((e) => {
        console.error('Failed to mark updates as seen:', e);
      });
    }
  };

  if (UPDATES.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="What's new">
          <Sparkles className="w-7 h-7" />
          {unseen.length > 0 && (
            <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-primary" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">What&apos;s new</DialogTitle>
          <DialogDescription>Recent changes to the Sixth Hour Cafe app.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-2">
          {UPDATES.map((update) => (
            <section key={update.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{update.title}</h3>
                {unseenIds.has(update.id) && <Badge>New</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {new Date(`${update.date}T00:00:00`).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {update.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
