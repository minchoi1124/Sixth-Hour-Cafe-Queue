'use client';

import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Bump to show the popup again to people who already dismissed it.
const ANNOUNCEMENT_ID = '2026-11-staff-passcode';
const SEEN_KEY = 'announcement.seen';

/**
 * One-time popup on the main page announcing the switch from staff accounts to
 * location passcodes. Shows until dismissed on this device; the link under the
 * sign-in card brings it back.
 */
export function PasscodeAnnouncement() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) === ANNOUNCEMENT_ID) return;
    } catch {
      // Storage blocked: show it every visit rather than never.
    }
    setOpen(true);
  }, []);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      try {
        localStorage.setItem(SEEN_KEY, ANNOUNCEMENT_ID);
      } catch {
        // Nothing to do.
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-base text-muted-foreground underline"
      >
        What changed with staff sign-in?
      </button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Megaphone className="h-6 w-6 text-primary" />
              Staff sign-in is changing
            </DialogTitle>
            <DialogDescription className="text-base">
              Staff can now sign in with a passcode, no account needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-base">
            <p>
              Hello everyone! To make it easier to run sixth hour when the location owner isn’t around, staff no longer need
              their own account. To login, pick your location on this page and enter the
              location’s <strong>staff passcode</strong>. Your phone stays signed in after that.
            </p>
            <p className="rounded-md bg-muted p-3">
              For now, every location’s passcode is <strong className="tracking-widest">000000</strong> unless changed by the owner.
            </p>
            <div className="rounded-md bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <p className="font-semibold">Owners: please change your passcode.</p>
              <p className="mt-1">
                For security reasons since this is a public application, I highly recommend changing it right away, since anyone who
                knows the default can get into your queue and menu. Log in and go to{' '}
                <strong>Settings → Staff passcode</strong>. Changing it signs out any phone that used the old passcode.
              </p>
            </div>
            <p className="text-muted-foreground">
              Staff who already have an account keep it, and it now has the same access as the owner. Owners still log in as before. Invite codes are no longer used.
            </p>
            <p>
              If you have any questions or issues, please reach out to me at <a href="tel:520-225-7945" className="text-primary underline">
                520-225-7945
              </a>!
            </p>
            <p>
              - <strong>Min</strong>
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)} className="w-full text-lg sm:w-auto">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
