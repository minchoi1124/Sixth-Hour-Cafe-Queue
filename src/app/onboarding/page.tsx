'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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

  const [name, setName] = useState('');
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
    () => (slugTouched ? slug : slugify(name)),
    [slug, slugTouched, name],
  );

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!user || user.isAnonymous) {
      router.replace('/login');
      return;
    }
    const cafeName = name.trim();
    const finalSlug = effectiveSlug;

    if (cafeName.length < 2) {
      setError('Please enter a cafe name (at least 2 characters).');
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
          name: cafeName,
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
        setError('Could not create your cafe. Please try again.');
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
        <h1 className="text-4xl font-bold tracking-tight">Set up your cafe</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Choose a name and a public link customers will use to order.
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Cafe details</CardTitle>
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
              <Label htmlFor="cafe-name">Cafe name</Label>
              <Input
                id="cafe-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sixth Hour Cafe"
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
                  placeholder="sixth-hour"
                  required
                />
              </div>
              <p className="text-sm text-muted-foreground">
                This is the link/QR you share with customers.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create my cafe'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
