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
import { useFirestore, useUser } from '@/firebase';
import { cafeDoc, slugDoc, isValidSlug, slugify } from '@/lib/cafe-paths';

export default function OnboardingPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const [location, setLocation] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Send unauthenticated visitors to login; send owners who already have a
  // cafe straight to the dashboard.
  useEffect(() => {
    if (isUserLoading) return;
    if (!user || user.isAnonymous) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    getDoc(cafeDoc(firestore, user.uid)).then((snap) => {
      if (!cancelled && snap.exists()) {
        router.replace('/staff');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user, isUserLoading, firestore, router]);

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
        tx.set(slugRef, { cafeId: user.uid });
        tx.set(cafeDoc(firestore, user.uid), {
          location: locationName,
          slug: finalSlug,
          createdAt: serverTimestamp(),
        });
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
          Set up your Sixth Hour Cafe location
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Name your location and choose a public link customers will use to order.
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
              {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create my location'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Joining an existing location?{' '}
            <Link href="/join" className="underline">Enter an invite code</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
