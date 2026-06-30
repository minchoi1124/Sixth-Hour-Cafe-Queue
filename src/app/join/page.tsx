'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { inviteCodeDoc, userCafeDoc } from '@/lib/cafe-paths';

export default function JoinPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const [code, setCode] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill the code from a shared /join?code=XXX link.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('code');
    if (param) setCode(param.toUpperCase());
  }, []);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user || user.isAnonymous) router.replace('/login');
  }, [user, isUserLoading, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!user || user.isAnonymous) {
      router.replace('/login');
      return;
    }
    if (!user.email) {
      setError('Your account has no email address, which is required to join.');
      return;
    }
    const finalCode = code.trim().toUpperCase();
    if (finalCode.length < 4) {
      setError('Enter the invite code from your manager.');
      return;
    }

    setIsPending(true);
    try {
      const codeSnap = await getDoc(inviteCodeDoc(firestore, finalCode));
      if (!codeSnap.exists()) {
        setError('That invite code is not valid. Double-check it with your manager.');
        setIsPending(false);
        return;
      }
      const cafeId = codeSnap.data().cafeId as string;

      await setDoc(userCafeDoc(firestore, user.uid), {
        cafeId,
        role: 'staff',
        email: user.email,
        code: finalCode,
        joinedAt: serverTimestamp(),
      });
      router.replace('/staff');
    } catch (e) {
      console.error('Failed to join location:', e);
      setError('Could not join with that code. Please try again.');
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
        <h1 className="text-4xl font-bold tracking-tight">Join a location</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Enter the invite code from the owner to start working this Sixth Hour Cafe location.
        </p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Invite code</CardTitle>
          <CardDescription>Ask the location owner for the code.</CardDescription>
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
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="7K2PQX9R"
                className="text-2xl h-14 tracking-widest"
                autoCapitalize="characters"
                autoComplete="off"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Join location'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Setting up your own cafe instead?{' '}
            <Link href="/onboarding" className="underline">Create a location</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
