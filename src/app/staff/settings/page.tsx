'use client';

import { useEffect, useState } from 'react';
import { updateDoc } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase, useCafeId } from '@/firebase';
import { cafeDoc } from '@/lib/cafe-paths';
import type { Cafe } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const firestore = useFirestore();
  const cafeId = useCafeId();

  const cafeRef = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return cafeDoc(firestore, cafeId);
  }, [firestore, cafeId]);

  const { data: cafe, isLoading } = useDoc<Cafe>(cafeRef);

  const [location, setLocation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Seed the input once the cafe doc loads.
  useEffect(() => {
    if (cafe?.location !== undefined) setLocation(cafe.location);
  }, [cafe?.location]);

  const trimmed = location.trim();
  const isDirty = !!cafe && trimmed !== cafe.location;
  const isValid = trimmed.length >= 2;

  const handleSave = async () => {
    if (!cafeRef || !isDirty || !isValid) return;
    setIsSaving(true);
    try {
      await updateDoc(cafeRef, { location: trimmed });
      toast({ title: 'Saved', description: 'Your location name has been updated.' });
    } catch (e) {
      console.error('Failed to update location:', e);
      toast({
        variant: 'destructive',
        title: 'Could not save',
        description: 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !cafe) {
    return (
      <div className="container mx-auto max-w-2xl p-4 sm:p-8">
        <Skeleton className="h-14 w-1/2 mb-4" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const orderUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/order/${cafe.slug}` : `/order/${cafe.slug}`;

  return (
    <div className="container mx-auto max-w-2xl p-4 sm:p-8 space-y-8">
      <div>
        <h1 className="text-5xl font-bold">Settings</h1>
        <p className="text-2xl text-muted-foreground">
          Manage your Sixth Hour Cafe location.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Location name</CardTitle>
          <CardDescription className="text-lg">
            Shown to customers as “Sixth Hour Cafe — {trimmed || cafe.location}”.
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
            {!isValid && trimmed.length > 0 && (
              <p className="text-destructive text-base">Use at least 2 characters.</p>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={!isDirty || !isValid || isSaving}
            className="text-xl py-6"
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Customer ordering link</CardTitle>
          <CardDescription className="text-lg">
            Open this on your customer-facing device, or share it as a link/QR.
            The link can’t be changed here — contact your admin if it needs to move.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block break-all rounded-md bg-muted p-4 text-lg">{orderUrl}</code>
        </CardContent>
      </Card>
    </div>
  );
}
