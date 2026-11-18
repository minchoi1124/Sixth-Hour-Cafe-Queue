'use client';

import { useState } from 'react';
import { Copy, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { toast } from '@/hooks/use-toast';
import { staffPasscodeDoc } from '@/lib/cafe-paths';
import { DEFAULT_STAFF_PASSCODE } from '@/lib/staff-passcode';

/**
 * Lets staff signed in with the passcode look it up, so they can let another
 * helper in when the owner isn't around. Read-only: owners change it in
 * Settings. Loads only while open.
 */
export function StaffPasscodeButton({ cafeId }: { cafeId: string }) {
  const firestore = useFirestore();
  const [open, setOpen] = useState(false);

  const passcodeRef = useMemoFirebase(
    () => (open ? staffPasscodeDoc(firestore, cafeId) : null),
    [open, firestore, cafeId],
  );
  const { data: saved, isLoading } = useDoc<{ passcode: string }>(passcodeRef);
  const passcode = saved?.passcode ?? DEFAULT_STAFF_PASSCODE;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(passcode);
      toast({ title: 'Passcode copied' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" title="See the staff passcode to let another helper in">
          <KeyRound className="h-5 w-5" />
          <span className="hidden md:inline">Passcode</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Staff passcode</DialogTitle>
          <DialogDescription className="text-base">
            Share it only with people helping at this location. They pick the location on the main
            page and enter it there.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 rounded-md bg-muted p-4">
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <span className="select-all break-all font-mono text-2xl">{passcode}</span>
          )}
          <Button variant="ghost" size="icon" onClick={handleCopy} disabled={isLoading} aria-label="Copy passcode">
            <Copy className="h-5 w-5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
