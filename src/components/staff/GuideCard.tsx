'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Per device: a convenience nudge, not something that has to follow the account.
const STORAGE_KEY = 'sixth-hour:guide-card-dismissed';

/** One-time pointer to /guide on the queue, until it's opened or dismissed. */
export function GuideCard() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(STORAGE_KEY) !== 'yes');
    } catch {
      // Storage unavailable; the guide is still one tap away in the top bar.
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'yes');
    } catch {
      // Not remembered; it shows again next visit.
    }
  };

  if (!visible) return null;

  return (
    // Phones: text on top, buttons underneath (side by side, the text was
    // squeezed to a word per line). From md up: one row.
    <div className="mb-4 rounded-lg border-2 border-primary/30 bg-primary/5 p-4 md:mb-6 md:flex md:items-center md:gap-4">
      <div className="flex items-start gap-3 md:flex-1 md:items-center md:gap-4">
        <BookOpen className="h-7 w-7 flex-shrink-0 text-primary md:h-8 md:w-8" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold md:text-xl">New here?</p>
          <p className="text-base text-muted-foreground md:text-lg">
            The guide covers setting up, running a service and fixing common problems.
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 md:mt-0">
        <Button asChild className="flex-1 text-lg md:flex-none" onClick={dismiss}>
          <Link href="/guide">Open the guide</Link>
        </Button>
        <Button variant="ghost" size="icon" className="h-11 w-11 md:h-10 md:w-10" onClick={dismiss} aria-label="Dismiss">
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
