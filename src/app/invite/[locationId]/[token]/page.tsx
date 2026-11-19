'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { AlertCircle, Loader2, UserPlus } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { callOwnersApi } from '@/lib/owners-client';
import { STAFF_LOCATION_CLAIM } from '@/lib/staff-passcode';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';

type Preview = { locationName: string; expiresAt: string };

/**
 * A co-owner invite link: /invite/{locationId}/{secret}. Shows which location
 * it's for, has the visitor sign in (or sign up) to an account, then makes
 * that account an owner there (src/lib/owners.ts).
 */
export default function InvitePage() {
  const { locationId, token } = useParams<{ locationId: string; token: string }>();
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  // A phone signed in with the staff passcode has no account to add.
  const [isStaffDevice, setIsStaffDevice] = useState(false);

  useEffect(() => {
    callOwnersApi<Preview>('invite-info', { locationId, token }, null)
      .then(setPreview)
      .catch((e: Error) => setError(e.message));
  }, [locationId, token]);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      setIsStaffDevice(false);
      return;
    }
    user
      .getIdTokenResult()
      .then(({ claims }) => setIsStaffDevice(typeof claims[STAFF_LOCATION_CLAIM] === 'string'))
      .catch(() => setIsStaffDevice(false));
  }, [user]);

  const hasAccount = !!user && !user.isAnonymous && !isStaffDevice;
  const loginHref = `/login?next=${encodeURIComponent(`/invite/${locationId}/${token}`)}`;

  const handleAccept = async () => {
    if (!user) return;
    setIsAccepting(true);
    setError(null);
    try {
      const result = await callOwnersApi<{ locationName: string; alreadyOwner: boolean }>(
        'accept',
        { locationId, token },
        user,
      );
      toast({
        title: result.alreadyOwner ? 'You already own this location' : `You’re now an owner of ${result.locationName}`,
        description: result.alreadyOwner ? 'The link wasn’t used up, so someone else can still use it.' : undefined,
      });
      router.replace('/staff');
    } catch (e) {
      setError((e as Error).message);
      setIsAccepting(false);
    }
  };

  return (
    <main className="container mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-4">
      <Logo className="mb-6 h-20 w-20" />
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <UserPlus className="h-6 w-6 text-primary" />
            Become a co-owner
          </CardTitle>
          <CardDescription className="text-base">
            {preview ? (
              <>
                You’ve been invited to help own <strong>Sixth Hour Cafe — {preview.locationName}</strong>.
                Owners can change its menu and settings, see its history and invite other owners.
              </>
            ) : error ? null : (
              'Checking your invite…'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!preview && !error && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {preview && !isUserLoading && (
            hasAccount ? (
              <>
                <p className="text-base">
                  Signed in as <strong>{user.email}</strong>.
                </p>
                <Button onClick={handleAccept} disabled={isAccepting} className="w-full py-6 text-lg">
                  {isAccepting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Accept and open it'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Not you?{' '}
                  <button type="button" className="underline" onClick={() => signOut(auth)}>
                    Sign out
                  </button>{' '}
                  and use another account.
                </p>
              </>
            ) : (
              <>
                <p className="text-base">
                  {isStaffDevice
                    ? 'This phone is signed in with the staff passcode. Sign in with your own account to accept.'
                    : 'Sign in, or create an account if you don’t have one, to accept.'}
                </p>
                <Button asChild className="w-full py-6 text-lg">
                  <Link href={loginHref}>Sign in to accept</Link>
                </Button>
              </>
            )
          )}

          {preview && (
            <p className="text-center text-sm text-muted-foreground">
              This link works once and expires{' '}
              {new Date(preview.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.
            </p>
          )}
          {error && (
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/" className="underline">Go to the main page</Link>
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
