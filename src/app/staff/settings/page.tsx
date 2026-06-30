'use client';

import { useEffect, useState } from 'react';
import { updateDoc, runTransaction, writeBatch, deleteDoc, query, where } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import {
  useDoc,
  useCollection,
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
  cafeInviteDoc,
  inviteCodeDoc,
  userCafesCol,
  userCafeDoc,
  generateInviteCode,
} from '@/lib/cafe-paths';
import type { Cafe } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, Copy, RefreshCw, Trash2, UserPlus } from 'lucide-react';

/** Prefix a bare domain with https:// so QR codes resolve correctly. */
function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

type Membership = { cafeId: string; role: string; email: string; code: string };

function StaffManager({ cafeId }: { cafeId: string }) {
  const firestore = useFirestore();
  const [isWorking, setIsWorking] = useState(false);

  const inviteRef = useMemoFirebase(() => cafeInviteDoc(firestore, cafeId), [firestore, cafeId]);
  const { data: invite } = useDoc<{ code: string }>(inviteRef);

  const staffQuery = useMemoFirebase(
    () => query(userCafesCol(firestore), where('cafeId', '==', cafeId)),
    [firestore, cafeId],
  );
  const { data: staff } = useCollection<Membership>(staffQuery);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const code = invite?.code ?? null;
  const joinLink = code ? `${origin}/join?code=${code}` : '';

  const handleGenerate = async () => {
    setIsWorking(true);
    try {
      const newCode = generateInviteCode();
      const batch = writeBatch(firestore);
      if (invite?.code) batch.delete(inviteCodeDoc(firestore, invite.code));
      batch.set(inviteCodeDoc(firestore, newCode), { cafeId });
      batch.set(cafeInviteDoc(firestore, cafeId), { code: newCode });
      await batch.commit();
      toast({
        title: code ? 'New code generated' : 'Invite code created',
        description: code ? 'The old code no longer works for new staff.' : undefined,
      });
    } catch (e) {
      console.error('Failed to generate invite code:', e);
      toast({ variant: 'destructive', title: 'Could not generate code', description: 'Please try again.' });
    } finally {
      setIsWorking(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied', description: text });
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy' });
    }
  };

  const handleRemove = async (uid: string, email: string) => {
    try {
      await deleteDoc(userCafeDoc(firestore, uid));
      toast({ title: 'Staff removed', description: `${email} can no longer access this location.` });
    } catch (e) {
      console.error('Failed to remove staff:', e);
      toast({ variant: 'destructive', title: 'Could not remove', description: 'Please try again.' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">Staff</CardTitle>
        <CardDescription className="text-lg">
          Share the invite code so staff can sign up and access this location’s queue and menu.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-lg">Invite code</Label>
          {code ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <code className="rounded-md bg-muted px-4 py-3 text-2xl font-bold tracking-widest">{code}</code>
                <Button variant="outline" size="icon" onClick={() => handleCopy(code)} aria-label="Copy code">
                  <Copy className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={joinLink} className="text-base" />
                <Button variant="outline" size="icon" onClick={() => handleCopy(joinLink)} aria-label="Copy join link">
                  <Copy className="h-5 w-5" />
                </Button>
              </div>
              <Button variant="ghost" onClick={handleGenerate} disabled={isWorking} className="text-base">
                <RefreshCw className="mr-2 h-4 w-4" /> Generate a new code
              </Button>
            </div>
          ) : (
            <Button onClick={handleGenerate} disabled={isWorking}>
              {isWorking ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><UserPlus className="mr-2 h-5 w-5" /> Create invite code</>)}
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-lg">Current staff</Label>
          {!staff || staff.length === 0 ? (
            <p className="text-muted-foreground">No staff have joined yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {staff.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-2 p-3">
                  <span className="break-all text-lg">{member.email}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(member.id, member.email)}
                    aria-label={`Remove ${member.email}`}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
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

      {/* Staff management */}
      <StaffManager cafeId={cafe.id} />

      {/* Read-only current link reference */}
      <p className="text-center text-base text-muted-foreground break-all">
        Current link: {orderUrl}
      </p>
    </div>
  );
}
