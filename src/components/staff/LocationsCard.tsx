'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { pointerLocationIds, userDoc } from '@/lib/cafe-paths';
import type { UserLocation } from '@/lib/definitions';
import { switchLocation, useOwnedLocations } from '@/components/staff/LocationSwitcher';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Settings → Your locations: every location this account owns, and adding one. */
export function LocationsCard({ cafeId }: { cafeId: string }) {
  const firestore = useFirestore();
  const { user } = useUser();

  const pointerRef = useMemoFirebase(() => (user ? userDoc(firestore, user.uid) : null), [firestore, user]);
  const { data: pointer } = useDoc<UserLocation>(pointerRef);
  const owned = useOwnedLocations(pointerLocationIds(pointer));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-3xl">Your locations</CardTitle>
        <CardDescription className="text-lg">
          Running Sixth Hour somewhere else too? Add it here and use this same account for both. Each
          location has its own menu, queue, history and staff passcode.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {owned === null ? (
          <Skeleton className="h-14 w-full" />
        ) : (
          <ul className="divide-y rounded-md border">
            {owned.map((location) => (
              <li key={location.id} className="flex items-center justify-between gap-3 p-3">
                <span className="min-w-0 truncate text-xl">{location.name}</span>
                {location.id === cafeId ? (
                  <Badge variant="secondary" className="text-base">Open now</Badge>
                ) : (
                  <Button
                    variant="outline"
                    className="text-base"
                    onClick={() => user && switchLocation(firestore, user.uid, location.id)}
                  >
                    Switch to it
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <Button asChild variant="outline" className="py-6 text-xl">
          <Link href="/onboarding?add=1">
            <Plus className="mr-2 h-5 w-5" /> Add another location
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
