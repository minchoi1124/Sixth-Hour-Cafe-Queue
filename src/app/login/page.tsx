'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FirebaseError } from 'firebase/app';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '@/firebase/non-blocking-login';

function authErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password.';
      case 'auth/email-already-in-use':
        return 'An account already exists with this email. Try signing in.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }
  return 'Something went wrong. Please try again.';
}

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once a real (non-anonymous) owner is signed in, leave the login page.
  // /staff decides whether they still need onboarding.
  useEffect(() => {
    if (!isUserLoading && user && !user.isAnonymous) {
      router.replace('/staff');
    }
  }, [user, isUserLoading, router]);

  const handleEmail = async (
    event: React.FormEvent<HTMLFormElement>,
    mode: 'signin' | 'signup',
  ) => {
    event.preventDefault();
    setError(null);
    setIsPending(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    try {
      if (mode === 'signup') {
        await signUpWithEmail(auth, email, password);
      } else {
        await signInWithEmail(auth, email, password);
      }
      // Redirect handled by the effect above on auth state change.
    } catch (e) {
      setError(authErrorMessage(e));
      setIsPending(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setIsPending(true);
    try {
      await signInWithGoogle(auth);
    } catch (e) {
      setError(authErrorMessage(e));
      setIsPending(false);
    }
  };

  return (
    <main className="container mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-4">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo className="mb-4 h-20 w-20" />
        <h1 className="text-4xl font-bold tracking-tight">Cafe Queue</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Run your cafe&apos;s order queue. Sign in to manage your menu.
        </p>
      </div>

      <Card className="w-full">
        <Tabs defaultValue="signin">
          <CardHeader>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-5 w-5" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <TabsContent value="signin" className="mt-0">
              <CardTitle className="mb-1 text-2xl">Welcome back</CardTitle>
              <CardDescription className="mb-4">
                Sign in to your cafe account.
              </CardDescription>
              <form onSubmit={(e) => handleEmail(e, 'signin')} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input id="signin-email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input id="signin-password" name="password" type="password" autoComplete="current-password" required />
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-0">
              <CardTitle className="mb-1 text-2xl">Create your cafe</CardTitle>
              <CardDescription className="mb-4">
                Sign up to start taking orders.
              </CardDescription>
              <form onSubmit={(e) => handleEmail(e, 'signup')} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" name="email" type="email" autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input id="signup-password" name="password" type="password" autoComplete="new-password" minLength={6} required />
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign Up'}
                </Button>
              </form>
            </TabsContent>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogle}
              disabled={isPending}
            >
              Continue with Google
            </Button>
          </CardContent>
        </Tabs>
      </Card>
    </main>
  );
}
