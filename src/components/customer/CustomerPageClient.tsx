
'use client';

import OrderForm from '@/components/customer/OrderForm';
import { Logo } from '@/components/Logo';
import type { Cafe, LiveMenu, MenuItem } from '@/lib/definitions';
import type { NextOpening } from '@/lib/data';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { cafeDoc, drinksCol } from '@/lib/cafe-paths';
import { resolveMenu } from '@/lib/presets';
import { formatSessionDate, formatSessionTime } from '@/lib/timezone';
import { Badge } from '@/components/ui/badge';
import { Coffee } from 'lucide-react';

/** The menu customers see when the cafe isn't open — greyed, not orderable. */
function ClosedScreen({
  drinks,
  nextOpening,
  timezone,
}: {
  drinks: MenuItem[];
  nextOpening: NextOpening | null;
  timezone: string;
}) {
  const opensAt = nextOpening?.startsAt ? new Date(nextOpening.startsAt) : null;

  return (
    <div className="mt-12 space-y-8">
      <div className="rounded-lg border-2 border-dashed p-8 text-center">
        <Coffee className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-4xl font-bold">We&apos;re closed right now</h2>
        {opensAt ? (
          <p className="mt-3 text-2xl text-muted-foreground">
            Opens {formatSessionDate(opensAt, timezone)} at{' '}
            <span className="font-medium text-foreground">
              {formatSessionTime(opensAt, timezone)}
            </span>
            {nextOpening?.location ? ` · ${nextOpening.location}` : ''}
          </p>
        ) : (
          <p className="mt-3 text-2xl text-muted-foreground">
            Check back soon — we&apos;ll be serving again before long.
          </p>
        )}
      </div>

      {drinks.length > 0 && (
        <div>
          <h3 className="mb-4 text-3xl font-category text-primary">
            {opensAt ? "What we'll be serving" : 'What we usually serve'}
          </h3>
          <ul className="grid grid-cols-1 gap-4">
            {drinks.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border-2 border-primary/10 bg-muted/40 p-6 opacity-60"
              >
                <span className="block text-2xl font-medium">{item.name}</span>
                {item.description && (
                  <p className="mt-1 text-lg text-muted-foreground">{item.description}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function CustomerPageClient({
  cafeId,
  location,
  menu: initialLibrary,
  instagramUrl,
  initialLiveMenu,
  nextOpening,
  timezone,
}: {
  cafeId: string;
  location: string;
  /** The whole drink library; what's orderable comes from `liveMenu`. */
  menu: MenuItem[];
  instagramUrl: string | null;
  initialLiveMenu: LiveMenu | null;
  nextOpening: NextOpening | null;
  timezone: string;
}) {
  const firestore = useFirestore();

  const libraryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return drinksCol(firestore, cafeId);
  }, [firestore, cafeId]);
  const { data: realTimeLibrary } = useCollection<MenuItem>(libraryQuery);

  // The cafe doc is world-readable and carries the public mirror of the active
  // session's menu, so an unauthenticated customer gets live menu and sold-out
  // updates without ever reading the staff-only session document.
  const cafeRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return cafeDoc(firestore, cafeId);
  }, [firestore, cafeId]);
  const { data: liveCafe } = useDoc<Cafe>(cafeRef);

  const library = realTimeLibrary ?? initialLibrary;
  // Use the server-rendered value only until the first snapshot arrives, so the
  // page doesn't flash "closed" on load while open.
  //
  // Keyed on whether a snapshot has ever landed, NOT on isLoading: useDoc sets
  // isLoading true again on every re-subscribe (it re-runs whenever the auth
  // user object changes identity, e.g. on token refresh), and gating on that
  // would snap the page back to the stale page-load menu each time.
  const liveMenu = liveCafe ? liveCafe.liveMenu ?? null : initialLiveMenu;

  const isOpen = !!liveMenu && liveMenu.drinkIds.length > 0;
  const orderableMenu = resolveMenu(library, liveMenu?.drinkIds);
  const soldOutIds = liveMenu?.soldOutIds ?? [];
  const previewMenu = resolveMenu(library, nextOpening?.menuIds);

  return (
    <>
      <main className="container mx-auto max-w-2xl p-4 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Logo className="w-24 h-24 mb-4" />
          <h1 className="text-5xl md:text-6xl font-bold tracking-tighter">
            Sixth Hour Cafe
          </h1>
          {location && (
            <p className="mt-2 text-2xl font-medium text-primary">{location}</p>
          )}
          {isOpen ? (
            <p className="mt-4 text-xl text-muted-foreground">Place your order below.</p>
          ) : (
            <Badge variant="secondary" className="mt-4 text-lg">Closed</Badge>
          )}
        </div>

        {isOpen ? (
          <div className="mt-12">
            <OrderForm
              cafeId={cafeId}
              menu={orderableMenu}
              soldOutIds={soldOutIds}
              instagramUrl={instagramUrl}
            />
          </div>
        ) : (
          <ClosedScreen
            drinks={previewMenu}
            nextOpening={nextOpening}
            timezone={timezone}
          />
        )}
      </main>
    </>
  );
}
