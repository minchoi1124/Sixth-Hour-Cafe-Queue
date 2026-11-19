'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDoc, updateDoc } from 'firebase/firestore';
import { Check, ChevronDown, Plus, Store } from 'lucide-react';
import { useFirestore, useUser } from '@/firebase';
import { cafeDoc, memberDoc, userDoc } from '@/lib/cafe-paths';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';

export type OwnedLocation = { id: string; name: string };

/**
 * The locations in `locationIds` this account still owns, with their names,
 * in the order listed. The list on the account is only a convenience, so each
 * one is checked against its member doc. `null` while loading.
 */
export function useOwnedLocations(locationIds: string[]): OwnedLocation[] | null {
  const firestore = useFirestore();
  const { user } = useUser();
  const [owned, setOwned] = useState<OwnedLocation[] | null>(null);
  const key = locationIds.join(',');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const ids = key ? key.split(',') : [];
    Promise.all(
      ids.map(async (id): Promise<OwnedLocation | null> => {
        try {
          const [member, location] = await Promise.all([
            getDoc(memberDoc(firestore, id, user.uid)),
            getDoc(cafeDoc(firestore, id)),
          ]);
          if (member.get('role') !== 'owner' || !location.exists()) return null;
          return { id, name: (location.get('location') as string | undefined) ?? id };
        } catch {
          return null;
        }
      }),
    ).then((found) => {
      if (!cancelled) setOwned(found.filter((location): location is OwnedLocation => location !== null));
    });
    return () => {
      cancelled = true;
    };
  }, [firestore, user, key]);

  return owned;
}

/** Moves the account to another location it owns; the layout follows the pointer. */
export async function switchLocation(
  firestore: ReturnType<typeof useFirestore>,
  uid: string,
  locationId: string,
) {
  try {
    await updateDoc(userDoc(firestore, uid), { locationId });
  } catch (e) {
    console.error('Failed to switch location:', e);
    toast({ variant: 'destructive', title: 'Could not switch', description: 'Please try again.' });
  }
}

/**
 * Header dropdown for owners of more than one location. Hidden for everyone
 * else; they add a second location from Settings.
 */
export function LocationSwitcher({
  cafeId,
  currentName,
  locationIds,
}: {
  cafeId: string;
  currentName: string;
  locationIds: string[];
}) {
  const firestore = useFirestore();
  const { user } = useUser();
  const owned = useOwnedLocations(locationIds);

  if (!user || !owned || owned.length < 2) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="max-w-[14rem] gap-2" title="Switch location">
          <Store className="h-5 w-5 flex-shrink-0" />
          <span className="truncate">{currentName}</span>
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[14rem]">
        <DropdownMenuLabel>Your locations</DropdownMenuLabel>
        {owned.map((location) => (
          <DropdownMenuItem
            key={location.id}
            className="text-base"
            onSelect={() => {
              if (location.id !== cafeId) switchLocation(firestore, user.uid, location.id);
            }}
          >
            <Check className={location.id === cafeId ? 'h-4 w-4' : 'h-4 w-4 opacity-0'} />
            {location.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="text-base">
          <Link href="/onboarding?add=1">
            <Plus className="h-4 w-4" />
            Add another location
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
