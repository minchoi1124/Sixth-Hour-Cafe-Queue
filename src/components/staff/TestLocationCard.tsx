'use client';

import { useState } from 'react';
import Link from 'next/link';
import { updateDoc } from 'firebase/firestore';
import { Copy, FlaskConical, Loader2, Plus, Trash2 } from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { cafeDoc } from '@/lib/cafe-paths';
import type { Cafe } from '@/lib/definitions';
import { REVEAL_PARAM } from '@/lib/location-picker';
import { postAsUser } from '@/lib/owners-client';
import type { ClearedTestLocation } from '@/lib/test-locations';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { toast } from '@/hooks/use-toast';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Settings → Test locations. Shown only to the app's admin (src/lib/admin.ts);
 * firestore.rules and /api/admin/clear-test-location check the claim too, so
 * hiding this card is not what keeps anyone else out.
 */
export function TestLocationCard({ cafe }: { cafe: Cafe }) {
  const isAdmin = useIsAdmin();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isUnhiding, setIsUnhiding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  if (!isAdmin) return null;

  const isTestLocation = cafe.hidden === true;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const staffLink = `${origin}/?${REVEAL_PARAM}=${encodeURIComponent(cafe.slug)}`;
  const customerLink = `${origin}/order/${cafe.slug}`;

  // One way only: the rules let `hidden` be switched off, never on, so a real
  // location can never be made clearable.
  const handleMakeNormal = async () => {
    setIsUnhiding(true);
    try {
      await updateDoc(cafeDoc(firestore, cafe.id), { hidden: false });
      toast({ title: 'Now a normal location', description: `${cafe.location} is in the location picker for everyone.` });
    } catch (e) {
      console.error('Failed to unhide:', e);
      toast({ variant: 'destructive', title: 'Could not save', description: 'Please try again.' });
    } finally {
      setIsUnhiding(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: text });
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy', description: text });
    }
  };

  const handleClear = async () => {
    setIsClearing(true);
    try {
      const { orders, sessions } = await postAsUser<ClearedTestLocation>(
        '/api/admin/clear-test-location',
        { locationId: cafe.id },
        user,
      );
      toast({
        title: 'Cleared',
        description: `Deleted ${orders} order${orders === 1 ? '' : 's'} and ${sessions} session${sessions === 1 ? '' : 's'}. Order numbers start at 1 again.`,
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Could not clear',
        description: e instanceof Error ? e.message : 'Please try again.',
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-3xl">
          <FlaskConical className="h-7 w-7" /> Test locations
        </CardTitle>
        <CardDescription className="text-lg">
          Only you see this. A test location works like any other, but it’s left out of the location
          picker on the main page, so nobody picks it by mistake, and you can clear its orders.{' '}
          {isTestLocation
            ? `${cafe.location} is a test location.`
            : `${cafe.location} is a normal location, so there’s nothing to change here.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isTestLocation && (
          <>
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-base text-muted-foreground">
                Staff sign-in that shows this location (bookmark it on a test phone):
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all text-sm">{staffLink}</code>
                <Button variant="outline" size="icon" onClick={() => copy(staffLink)} title="Copy link">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="pt-2 text-base text-muted-foreground">Customer screen:</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all text-sm">{customerLink}</code>
                <Button variant="outline" size="icon" onClick={() => copy(customerLink)} title="Copy link">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full py-6 text-xl text-destructive" disabled={isClearing}>
                  {isClearing ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-5 w-5" />
                  )}
                  Clear test orders
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear {cafe.location}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deletes every order and session here, including scheduled ones, and closes it if
                    a session is running. Order numbers start at 1 again. The menu, presets, recipes,
                    passcode and owners stay. This can’t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClear} variant="destructive">
                    Yes, clear it
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="w-full text-base text-muted-foreground" disabled={isUnhiding}>
                  {isUnhiding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Make it a normal location
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Make {cafe.location} a normal location?</AlertDialogTitle>
                  <AlertDialogDescription>
                    It shows in the location picker for everyone, and its orders can no longer be
                    cleared. This can’t be turned back into a test location.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleMakeNormal}>Yes, make it normal</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        <Button asChild variant="outline" className="w-full py-6 text-xl">
          <Link href="/onboarding?add=1&test=1">
            <Plus className="mr-2 h-5 w-5" /> Create a test location
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
