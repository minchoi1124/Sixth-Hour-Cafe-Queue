'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useAuth, useFirestore, useUser } from '@/firebase';
import {
  cafeDoc,
  memberDoc,
  slugDoc,
  userDoc,
  isValidSlug,
  pointerLocationIds,
  slugify,
} from '@/lib/cafe-paths';
import type { UserLocation } from '@/lib/definitions';
import { LATEST_UPDATE_ID } from '@/lib/updates';
import { STAFF_LOCATION_CLAIM } from '@/lib/staff-passcode';
import { idPart, pickFreeId } from '@/lib/readable-ids';
import { useIsAdmin } from '@/hooks/use-is-admin';

/** A hard-to-guess link for a test location, e.g. test-k7q2px. */
function randomTestSlug(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `test-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')}`;
}

export default function OnboardingPage() {
  const firestore = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const [location, setLocation] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `/onboarding?add=1`: an owner adding another location. Read from the URL
  // after mounting, which avoids a Suspense boundary for useSearchParams.
  const [isAdding, setIsAdding] = useState<boolean | null>(null);
  // `&test=1` as well: the admin making a hidden test location
  // (src/lib/test-locations.ts). Anyone else just adds a normal one; the rules
  // refuse `hidden` from them anyway.
  const [wantsTest, setWantsTest] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsAdding(params.get('add') === '1');
    setWantsTest(params.get('test') === '1');
  }, []);
  const isAdmin = useIsAdmin();
  const isTest = Boolean(isAdding && wantsTest && isAdmin);

  useEffect(() => {
    if (!isTest) return;
    setLocation((current) => current || 'Test kitchen');
    setSlug(randomTestSlug());
    setSlugTouched(true);
  }, [isTest]);

  // Send unauthenticated visitors to login; send owners who already have a
  // cafe (unless they're adding another), and staff phones signed in with a
  // passcode, straight to the dashboard. A pointer with role 'staff' is left
  // over from the old invites and doesn't count, or /staff would send it
  // straight back here.
  useEffect(() => {
    if (isUserLoading || isAdding === null) return;
    if (!user || user.isAnonymous) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      const { claims } = await user.getIdTokenResult();
      if (cancelled) return;
      if (typeof claims[STAFF_LOCATION_CLAIM] === 'string') {
        router.replace('/staff');
        return;
      }
      if (isAdding) return;
      const snap = await getDoc(userDoc(firestore, user.uid));
      if (!cancelled && snap.exists() && snap.get('role') === 'owner') {
        router.replace('/staff');
      }
    })().catch((e) => console.error('Failed to check for an existing location:', e));
    return () => {
      cancelled = true;
    };
  }, [user, isUserLoading, isAdding, firestore, router]);

  const effectiveSlug = useMemo(
    () => (slugTouched ? slug : slugify(location)),
    [slug, slugTouched, location],
  );

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!user || user.isAnonymous) {
      router.replace('/login');
      return;
    }
    const locationName = location.trim();
    const finalSlug = effectiveSlug;

    if (locationName.length < 2) {
      setError('Please enter a location name (at least 2 characters).');
      return;
    }
    if (!isValidSlug(finalSlug)) {
      setError(
        'Link must be 3-30 characters: lowercase letters, numbers, and hyphens only.',
      );
      return;
    }

    setIsPending(true);
    try {
      await runTransaction(firestore, async (tx) => {
        const slugRef = slugDoc(firestore, finalSlug);
        const existing = await tx.get(slugRef);
        if (existing.exists()) {
          throw new Error('SLUG_TAKEN');
        }
        // An owner adding another location keeps the ones they have.
        const pointerSnap = await tx.get(userDoc(firestore, user.uid));
        const pointer = pointerSnap.exists() ? (pointerSnap.data() as UserLocation) : null;
        const owned = pointer?.role === 'owner' ? pointerLocationIds(pointer) : [];
        // The id is readable and permanent; the slug is the changeable link.
        // All reads must come before any write in a transaction.
        const locationId = await pickFreeId(
          idPart(locationName, 30, 'location'),
          async (candidate) => (await tx.get(cafeDoc(firestore, candidate))).exists(),
        );
        const email = user.email ?? null;
        tx.set(cafeDoc(firestore, locationId), {
          location: locationName,
          slug: finalSlug,
          createdAt: serverTimestamp(),
          // Hidden from the first write, so it never shows in the picker.
          ...(isTest ? { hidden: true } : {}),
        });
        tx.set(memberDoc(firestore, locationId, user.uid), {
          email,
          role: 'owner',
          joinedAt: serverTimestamp(),
        });
        // New accounts start caught up rather than with the whole update
        // history; an existing one keeps where it was.
        const lastSeenUpdate = pointer ? pointer.lastSeenUpdate : LATEST_UPDATE_ID;
        tx.set(userDoc(firestore, user.uid), {
          locationId,
          locationIds: Array.from(new Set([...owned, locationId])),
          role: 'owner',
          email,
          ...(lastSeenUpdate ? { lastSeenUpdate } : {}),
        });
        tx.set(slugRef, { locationId });
      });
      router.replace('/staff');
    } catch (e) {
      if (e instanceof Error && e.message === 'SLUG_TAKEN') {
        setError('That link is already taken. Please choose another.');
      } else {
        console.error('Onboarding failed:', e);
        setError('Could not create your location. Please try again.');
      }
      setIsPending(false);
    }
  };

  if (isUserLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="container mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo className="mb-4 h-20 w-20" />
        <h1 className="text-4xl font-bold tracking-tight">
          {isTest
            ? 'Create a test location'
            : isAdding
              ? 'Add another location'
              : 'Set up your Sixth Hour Cafe location'}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {isTest
            ? 'A location of its own for test orders, hidden from the location picker. Open it from the switcher at the top, or its link.'
            : isAdding
              ? 'It gets its own menu, queue, history and staff passcode. Switch between your locations from the top of the screen.'
              : 'Name your location and choose a public link customers will use to order.'}
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Location details</CardTitle>
          <CardDescription>You can change these later.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="cafe-location">Location name</Label>
              <Input
                id="cafe-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. MSU Campus"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cafe-slug">Public link</Label>
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {origin}/order/
                </span>
                <Input
                  id="cafe-slug"
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugify(e.target.value));
                  }}
                  placeholder="msu"
                  required
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Customers order from this link — open it on your customer-facing
                device, or share it as a link/QR.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isTest ? (
                'Create test location'
              ) : (
                'Create my location'
              )}
            </Button>
          </form>
          {isAdding ? (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link href="/staff" className="underline">Cancel and go back</Link>
            </p>
          ) : (
          <>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Working at an existing location? You don’t need an account.{' '}
            <button
              type="button"
              className="underline"
              onClick={() => signOut(auth).then(() => router.replace('/'))}
            >
              Sign out and use the staff passcode instead
            </button>
          </p>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            New to the app? <Link href="/guide" className="underline">Read how it works</Link>
          </p>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Got a link to help own a location? Open it while signed in to join that one instead.
          </p>
          </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
