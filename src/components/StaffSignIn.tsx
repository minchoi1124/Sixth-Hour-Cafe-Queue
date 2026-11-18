'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAppCheckToken, useAuth, useUser } from '@/firebase';
import type { LocationChoice } from '@/lib/data';
import { PASSCODE_MAX_LENGTH, normalizePasscode } from '@/lib/staff-passcode';

// The location picked last time on this phone, so a returning helper only
// types the passcode.
const LAST_LOCATION_KEY = 'staffSignIn.lastLocation';

/** Pick a location, type its passcode, and this device is signed in as staff. */
export function StaffSignIn({ locations }: { locations: LocationChoice[] }) {
  const auth = useAuth();
  const router = useRouter();
  const { user, isUserLoading } = useUser();

  const [locationId, setLocationId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_LOCATION_KEY);
      if (last && locations.some((location) => location.id === last)) setLocationId(last);
    } catch {
      // Storage blocked: they just pick it again.
    }
  }, [locations]);

  const signedIn = !isUserLoading && user && !user.isAnonymous;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!locationId) {
      setError('Pick your location.');
      return;
    }
    if (normalizePasscode(passcode).length === 0) {
      setError('Enter the staff passcode.');
      return;
    }

    setIsPending(true);
    try {
      const appCheckToken = await getAppCheckToken();
      const response = await fetch('/api/staff-signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
        },
        body: JSON.stringify({ locationId, passcode }),
      });
      const result = (await response.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!response.ok || !result.token) {
        setError(result.error ?? 'Something went wrong. Please try again.');
        setIsPending(false);
        return;
      }
      await signInWithCustomToken(auth, result.token);
      try {
        localStorage.setItem(LAST_LOCATION_KEY, locationId);
      } catch {
        // Not remembering the location is fine.
      }
      router.push('/staff');
    } catch (e) {
      console.error('Staff sign-in failed:', e);
      setError('Something went wrong. Please try again.');
      setIsPending(false);
    }
  };

  return (
    <Card className="w-full text-left">
      <CardHeader>
        <CardTitle className="text-3xl">Working a shift?</CardTitle>
        <CardDescription className="text-lg">
          Pick your location and enter its staff passcode. No account needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {signedIn && (
          <Button asChild variant="secondary" className="w-full justify-between py-6 text-xl">
            <Link href="/staff">
              You’re signed in. Open the queue <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="text-base">{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staff-location" className="text-lg">Location</Label>
            <Select value={locationId} onValueChange={setLocationId} disabled={locations.length === 0}>
              <SelectTrigger id="staff-location" className="h-14 text-xl">
                <SelectValue placeholder={locations.length === 0 ? 'No locations yet' : 'Choose your location'} />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id} className="text-lg">
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-passcode" className="text-lg">Staff passcode</Label>
            <Input
              id="staff-passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.slice(0, PASSCODE_MAX_LENGTH))}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. password123"
              className="h-14 text-xl"
            />
            <p className="text-sm text-muted-foreground">Capital letters don’t matter.</p>
          </div>
          <Button type="submit" disabled={isPending} className="w-full py-6 text-xl">
            {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Log in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
