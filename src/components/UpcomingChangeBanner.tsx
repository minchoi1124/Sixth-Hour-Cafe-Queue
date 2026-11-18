'use client';

import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Heads-up for the staff sign-in change deploying Nov 19, 2026 at 3:00 AM
// Eastern (08:00 UTC). Hides itself after that time; the deploy removes it.
const CHANGE_AT = Date.UTC(2026, 10, 19, 8, 0, 0);
const DISMISSED_KEY = 'upcomingChangeBanner.dismissed';

export function UpcomingChangeBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (Date.now() >= CHANGE_AT) return;
    try {
      if (localStorage.getItem(DISMISSED_KEY) === String(CHANGE_AT)) return;
    } catch {
      // Storage blocked: show it.
    }
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, String(CHANGE_AT));
    } catch {
      // Nothing to do.
    }
  };

  return (
    <div className="border-b bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
      <div className="container mx-auto flex items-start gap-3 p-4 text-left">
        <Megaphone className="mt-0.5 h-6 w-6 shrink-0" />
        <div className="flex-1 space-y-1 text-base">
          <p className="font-semibold">Heads up: staff sign-in is changing tonight at 3 AM Eastern.</p>
          <p>
            After that, helpers won’t need their own account. To log in, pick your location on the
            main page and enter the location’s staff passcode, which is <strong>000000</strong> until
            the owner changes it. If you already have a staff account, you keep it, and it will have
            the same access as the owner. Owners still log in as before, and should change the
            passcode in Settings → Staff passcode.
          </p>
          <p>
            Questions? Reach me at{' '}
            <a href="tel:520-225-7945" className="underline">520-225-7945</a>. – Min
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss" className="shrink-0">
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
