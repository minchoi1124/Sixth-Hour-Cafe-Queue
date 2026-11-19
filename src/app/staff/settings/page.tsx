'use client';

import { useEffect, useState } from 'react';
import { updateDoc, runTransaction, writeBatch, increment } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import {
  useDoc,
  useFirestore,
  useMemoFirebase,
  useCafeId,
  useCafeRole,
} from '@/firebase';
import {
  cafeDoc,
  slugDoc,
  isValidSlug,
  slugify,
  staffPasscodeDoc,
} from '@/lib/cafe-paths';
import {
  DEFAULT_STAFF_PASSCODE,
  PASSCODE_MAX_LENGTH,
  PASSCODE_MIN_LENGTH,
  generateStaffPasscode,
  normalizePasscode,
  passcodeProblem,
} from '@/lib/staff-passcode';
import type { Cafe } from '@/lib/definitions';
import { OwnersCard } from '@/components/staff/OwnersCard';
import { LocationsCard } from '@/components/staff/LocationsCard';
import { TestLocationCard } from '@/components/staff/TestLocationCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { COMMON_TIMEZONES, cafeTimezone } from '@/lib/timezone';
import { toast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, Copy, RefreshCw, Eye, EyeOff } from 'lucide-react';

/** Prefix a bare domain with https:// so QR codes resolve correctly. */
function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function StaffPasscodeCard({ cafeId }: { cafeId: string }) {
  const firestore = useFirestore();
  const [isRevealed, setIsRevealed] = useState(false);
  const [newPasscode, setNewPasscode] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const passcodeRef = useMemoFirebase(() => staffPasscodeDoc(firestore, cafeId), [firestore, cafeId]);
  const { data: saved, isLoading } = useDoc<{ passcode: string }>(passcodeRef);

  const currentPasscode = saved?.passcode ?? DEFAULT_STAFF_PASSCODE;
  const isDefault = normalizePasscode(currentPasscode) === DEFAULT_STAFF_PASSCODE;

  // Shown only once they've typed something.
  const typed = newPasscode.trim().length > 0;
  const problem = !typed
    ? null
    : normalizePasscode(newPasscode) === DEFAULT_STAFF_PASSCODE
      ? 'Pick something other than 000000.'
      : normalizePasscode(newPasscode) === normalizePasscode(currentPasscode)
        ? 'That’s already the passcode.'
        : passcodeProblem(newPasscode);
  const newPasscodeValid = typed && problem === null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentPasscode);
      toast({ title: 'Passcode copied' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy' });
    }
  };

  const handleSave = async () => {
    if (!newPasscodeValid) return;
    setIsSaving(true);
    try {
      // Saving the passcode and bumping the version together is what signs
      // out every staff device that used the old one (see src/lib/staff-passcode.ts).
      const batch = writeBatch(firestore);
      batch.set(passcodeRef, { passcode: newPasscode.trim().replace(/\s+/g, ' ') });
      batch.update(cafeDoc(firestore, cafeId), { staffPasscodeVersion: increment(1) });
      await batch.commit();
      setNewPasscode('');
      setIsRevealed(true);
      toast({
        title: 'Staff passcode changed',
        description: 'Phones signed in with the old passcode have been signed out. Share the new one with your staff.',
      });
    } catch (e) {
      console.error('Failed to change staff passcode:', e);
      toast({ variant: 'destructive', title: 'Could not save', description: 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">Staff passcode</CardTitle>
        <CardDescription className="text-lg">
          Staff don’t need accounts. On the main page they pick this location and enter this
          passcode. Their phone stays signed in until they leave or you change the passcode.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isDefault && !isLoading && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-base text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>
              Your passcode is still the default, <strong>000000</strong>. Anyone can guess it and get
              into your queue and menu. Change it below.
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-lg">Current passcode</Label>
          <div className="flex items-center gap-2">
            <code className="min-w-0 break-all rounded-md bg-muted px-4 py-3 text-2xl font-bold">
              {isLoading ? '······' : isRevealed ? currentPasscode : '••••••'}
            </code>
            <Button
              variant="outline"
              size="icon"
              className="flex-shrink-0"
              onClick={() => setIsRevealed((shown) => !shown)}
              aria-label={isRevealed ? 'Hide passcode' : 'Show passcode'}
              disabled={isLoading}
            >
              {isRevealed ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="flex-shrink-0"
              onClick={handleCopy}
              aria-label="Copy passcode"
              disabled={isLoading}
            >
              <Copy className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-passcode" className="text-lg">New passcode</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="new-passcode"
              value={newPasscode}
              onChange={(e) => setNewPasscode(e.target.value.slice(0, PASSCODE_MAX_LENGTH))}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. password123"
              className="h-12 text-xl"
            />
            <Button
              variant="ghost"
              onClick={() => setNewPasscode(generateStaffPasscode())}
              className="flex-shrink-0 text-base"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Make one up
            </Button>
          </div>
          {problem && <p className="text-base text-destructive">{problem}</p>}
          <p className="text-base text-muted-foreground">
            Pick a few words that are easy to say and remember, at least {PASSCODE_MIN_LENGTH} characters.
            Capital letters don’t matter. Changing it signs out every staff phone; they’ll need the new
            passcode to get back in.
          </p>
        </div>
        <Button onClick={handleSave} disabled={!newPasscodeValid || isSaving} className="py-6 text-xl">
          {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Change passcode'}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const firestore = useFirestore();
  const cafeId = useCafeId();
  const role = useCafeRole();

  const cafeRef = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return cafeDoc(firestore, cafeId);
  }, [firestore, cafeId]);

  const { data: cafe, isLoading } = useDoc<Cafe>(cafeRef);

  // --- Location ---
  const [location, setLocation] = useState('');
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  // --- Timezone (groups sessions by local calendar date) ---
  const [timezone, setTimezone] = useState(cafeTimezone());
  const [isSavingTimezone, setIsSavingTimezone] = useState(false);

  // --- Link / slug ---
  const [slug, setSlug] = useState('');
  const [isSavingLink, setIsSavingLink] = useState(false);

  // --- Instagram ---
  const [instagramEnabled, setInstagramEnabled] = useState(false);
  const [instagramUrl, setInstagramUrl] = useState('');
  const [isSavingInstagram, setIsSavingInstagram] = useState(false);

  // Seed inputs once the cafe doc loads / changes.
  useEffect(() => {
    if (!cafe) return;
    setLocation(cafe.location ?? '');
    setTimezone(cafeTimezone(cafe.timezone));
    setSlug(cafe.slug ?? '');
    setInstagramEnabled(cafe.instagramEnabled ?? false);
    setInstagramUrl(cafe.instagramUrl ?? '');
  }, [cafe]);

  if (isLoading || !cafe) {
    return (
      <div className="container mx-auto max-w-2xl p-4 sm:p-8">
        <Skeleton className="h-14 w-1/2 mb-4" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Settings are owner-only; staff are routed away in the nav but may reach the URL.
  if (role !== 'owner') {
    return (
      <div className="container mx-auto max-w-2xl p-4 sm:p-8">
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="mt-3 text-xl text-muted-foreground">
          Only the location owner can change settings.
        </p>
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // --- Handlers ---
  const trimmedLocation = location.trim();
  const locationDirty = trimmedLocation !== cafe.location;
  const locationValid = trimmedLocation.length >= 2;

  const handleSaveLocation = async () => {
    if (!cafeRef || !locationDirty || !locationValid) return;
    setIsSavingLocation(true);
    try {
      await updateDoc(cafeRef, { location: trimmedLocation });
      toast({ title: 'Saved', description: 'Your location name has been updated.' });
    } catch (e) {
      console.error('Failed to update location:', e);
      toast({ variant: 'destructive', title: 'Could not save', description: 'Please try again.' });
    } finally {
      setIsSavingLocation(false);
    }
  };

  // Offer the standard list plus the browser's own zone, if it's not already there.
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneOptions = Array.from(
    new Set([...COMMON_TIMEZONES, browserTimezone, timezone].filter(Boolean)),
  );
  const timezoneDirty = timezone !== cafeTimezone(cafe.timezone);

  const handleSaveTimezone = async () => {
    if (!cafeRef || !timezoneDirty) return;
    setIsSavingTimezone(true);
    try {
      await updateDoc(cafeRef, { timezone });
      toast({ title: 'Saved', description: 'Session dates now use this timezone.' });
    } catch (e) {
      console.error('Failed to update timezone:', e);
      toast({ variant: 'destructive', title: 'Could not save', description: 'Please try again.' });
    } finally {
      setIsSavingTimezone(false);
    }
  };

  const linkDirty = slug !== cafe.slug;
  const linkValid = isValidSlug(slug);

  const handleSaveLink = async () => {
    if (!firestore || !cafeId || !linkDirty) return;
    if (!linkValid) {
      toast({
        variant: 'destructive',
        title: 'Invalid link',
        description: '3–30 characters: lowercase letters, numbers, and hyphens only.',
      });
      return;
    }
    setIsSavingLink(true);
    try {
      await runTransaction(firestore, async (tx) => {
        const newRef = slugDoc(firestore, slug);
        const existing = await tx.get(newRef);
        if (existing.exists()) throw new Error('SLUG_TAKEN');
        tx.set(newRef, { locationId: cafeId });
        tx.update(cafeDoc(firestore, cafeId), { slug });
        tx.delete(slugDoc(firestore, cafe.slug));
      });
      toast({ title: 'Link updated', description: `Customers now order at /order/${slug}` });
    } catch (e) {
      if (e instanceof Error && e.message === 'SLUG_TAKEN') {
        toast({ variant: 'destructive', title: 'Link taken', description: 'Choose a different link.' });
      } else {
        console.error('Failed to change link:', e);
        toast({ variant: 'destructive', title: 'Could not save', description: 'Please try again.' });
      }
    } finally {
      setIsSavingLink(false);
    }
  };

  const normalizedInstagram = normalizeUrl(instagramUrl);
  const instagramDirty =
    instagramEnabled !== (cafe.instagramEnabled ?? false) ||
    normalizedInstagram !== (cafe.instagramUrl ?? '');
  const instagramValid = !instagramEnabled || normalizedInstagram.length > 0;

  const handleSaveInstagram = async () => {
    if (!cafeRef || !instagramDirty || !instagramValid) return;
    setIsSavingInstagram(true);
    try {
      await updateDoc(cafeRef, {
        instagramEnabled,
        instagramUrl: normalizedInstagram,
      });
      setInstagramUrl(normalizedInstagram);
      toast({ title: 'Saved', description: 'Instagram settings updated.' });
    } catch (e) {
      console.error('Failed to update Instagram settings:', e);
      toast({ variant: 'destructive', title: 'Could not save', description: 'Please try again.' });
    } finally {
      setIsSavingInstagram(false);
    }
  };

  const orderUrl = `${origin}/order/${cafe.slug}`;

  return (
    <div className="container mx-auto max-w-2xl p-4 sm:p-8 space-y-8">
      <div>
        <h1 className="text-5xl font-bold">Settings</h1>
        <p className="text-2xl text-muted-foreground">
          Manage your Sixth Hour Cafe location.
        </p>
      </div>

      {/* Staff passcode */}
      <StaffPasscodeCard cafeId={cafe.id} />

      {/* Co-owners */}
      <OwnersCard cafeId={cafe.id} locationName={cafe.location} />

      {/* Location name */}
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Location name</CardTitle>
          <CardDescription className="text-lg">
            Shown to customers as “Sixth Hour Cafe — {trimmedLocation || cafe.location}”.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="location" className="text-lg">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. East Lansing"
              className="text-2xl h-14"
            />
            {!locationValid && trimmedLocation.length > 0 && (
              <p className="text-destructive text-base">Use at least 2 characters.</p>
            )}
          </div>
          <Button onClick={handleSaveLocation} disabled={!locationDirty || !locationValid || isSavingLocation} className="text-xl py-6">
            {isSavingLocation ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Timezone */}
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Timezone</CardTitle>
          <CardDescription className="text-lg">
            Used to date your sessions and prefill the start time when you begin one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="timezone" className="text-lg">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone" className="h-14 text-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezoneOptions.map((tz) => (
                  <SelectItem key={tz} value={tz} className="text-lg">
                    {tz.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSaveTimezone} disabled={!timezoneDirty || isSavingTimezone} className="text-xl py-6">
            {isSavingTimezone ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Customer ordering link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Customer ordering link</CardTitle>
          <CardDescription className="text-lg">
            The link customers use to order. Open it on your customer-facing device, or share it as a link/QR.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slug" className="text-lg">Link</Label>
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-base text-muted-foreground">{origin}/order/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="east-lansing"
                className="text-xl h-12"
              />
            </div>
            {!linkValid && slug.length > 0 && (
              <p className="text-destructive text-base">3–30 characters: lowercase letters, numbers, hyphens.</p>
            )}
          </div>
          {linkDirty && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-base text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <span>Changing this breaks your existing link and any printed QR codes. You’ll need to reload the customer device and reprint codes.</span>
            </div>
          )}
          <Button onClick={handleSaveLink} disabled={!linkDirty || !linkValid || isSavingLink} className="text-xl py-6">
            {isSavingLink ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Update link'}
          </Button>
        </CardContent>
      </Card>

      {/* Instagram QR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Instagram QR</CardTitle>
          <CardDescription className="text-lg">
            After ordering, customers can see a QR to your Instagram. Turn it off if you don’t have one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <Switch id="instagram-enabled" checked={instagramEnabled} onCheckedChange={setInstagramEnabled} />
            <Label htmlFor="instagram-enabled" className="text-lg">
              Show Instagram QR on the order confirmation screen
            </Label>
          </div>

          {instagramEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="instagram-url" className="text-lg">Instagram link</Label>
                <Input
                  id="instagram-url"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="instagram.com/your-cafe"
                  className="text-xl h-12"
                />
                {!instagramValid && (
                  <p className="text-destructive text-base">Enter your Instagram link to show the QR.</p>
                )}
              </div>

              {normalizedInstagram && (
                <div className="flex flex-col items-center gap-2 rounded-md border p-4">
                  <span className="text-base text-muted-foreground">Preview</span>
                  <QRCodeSVG value={normalizedInstagram} size={160} />
                  <span className="break-all text-sm text-muted-foreground">{normalizedInstagram}</span>
                </div>
              )}
            </>
          )}

          <Button onClick={handleSaveInstagram} disabled={!instagramDirty || !instagramValid || isSavingInstagram} className="text-xl py-6">
            {isSavingInstagram ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Other locations this account owns */}
      <LocationsCard cafeId={cafe.id} />

      {/* Admin only: hiding this location, clearing it, making another */}
      <TestLocationCard cafe={cafe} />

      {/* Read-only current link reference */}
      <p className="text-center text-base text-muted-foreground break-all">
        Current link: {orderUrl}
      </p>
    </div>
  );
}
