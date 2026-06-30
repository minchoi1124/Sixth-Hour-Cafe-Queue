'use client';

import { useEffect, useState } from 'react';
import { updateDoc, runTransaction } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { useDoc, useFirestore, useMemoFirebase, useCafeId } from '@/firebase';
import { cafeDoc, slugDoc, isValidSlug, slugify } from '@/lib/cafe-paths';
import type { Cafe } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';

/** Prefix a bare domain with https:// so QR codes resolve correctly. */
function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function SettingsPage() {
  const firestore = useFirestore();
  const cafeId = useCafeId();

  const cafeRef = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return cafeDoc(firestore, cafeId);
  }, [firestore, cafeId]);

  const { data: cafe, isLoading } = useDoc<Cafe>(cafeRef);

  // --- Location ---
  const [location, setLocation] = useState('');
  const [isSavingLocation, setIsSavingLocation] = useState(false);

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
        tx.set(newRef, { cafeId });
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

      {/* Read-only current link reference */}
      <p className="text-center text-base text-muted-foreground break-all">
        Current link: {orderUrl}
      </p>
    </div>
  );
}
