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
    <div className="mb-6 flex items-center gap-4 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
      <BookOpen className="h-8 w-8 flex-shrink-0 text-primary" />
      <div className="flex-1">
        <p className="text-xl font-semibold">New here?</p>
        <p className="text-lg text-muted-foreground">
          The guide covers setting up, running a service and fixing common problems.
        </p>
      </div>
      <Button asChild className="text-lg" onClick={dismiss}>
        <Link href="/guide">Open the guide</Link>
      </Button>
      <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss">
        <X className="h-5 w-5" />
      </Button>
    </div>
  );
}
