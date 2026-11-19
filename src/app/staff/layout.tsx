'use client';

import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Maximize,
  Minimize,
  LogOut,
  QrCode,
  Loader2,
  CircleHelp,
  ClipboardList,
  Coffee,
  BarChart3,
  Settings,
  KeyRound,
  MoreHorizontal,
  Check,
  Plus,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { signOut } from 'firebase/auth';
import {
  useAuth,
  useUser,
  useDoc,
  useFirestore,
  useMemoFirebase,
  useResolveCafe,
  CafeProvider,
} from '@/firebase';
import { cafeDoc } from '@/lib/cafe-paths';
import type { Cafe } from '@/lib/definitions';
import { WhatsNew } from '@/components/staff/WhatsNew';
import { StaffPasscodeButton, StaffPasscodeDialog } from '@/components/staff/StaffPasscodeButton';
import {
  LocationSwitcher,
  switchLocation,
  useOwnedLocations,
} from '@/components/staff/LocationSwitcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWakeLock } from '@/hooks/use-wake-lock';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { passcodeVersionOf } from '@/lib/staff-passcode';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const NavLink = ({ href, children }: { href: string, children: React.ReactNode }) => {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "px-6 py-3 rounded-lg text-2xl transition-colors",
        isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent"
      )}
    >
      {children}
    </Link>
  );
};

function CustomerScreenButton({ slug }: { slug: string }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(`${window.location.origin}/order/${slug}`);
  }, [slug]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" title="Show a QR code to open the ordering page on your customer-facing device">
          <QrCode className="h-5 w-5" />
          <span className="hidden md:inline">Customer screen</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Open the customer screen</DialogTitle>
          <DialogDescription>
            Scan this with the customer-facing device's camera, or type the link below.
          </DialogDescription>
        </DialogHeader>
        {url && (
          <div className="flex flex-col items-center gap-4 py-2">
            {/* White backing keeps the code scannable in dark mode. */}
            <div className="rounded-lg bg-white p-4">
              <QRCodeSVG value={url} size={256} />
            </div>
            <span className="select-all break-all text-center text-xl font-mono">{url}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const TABS = [
  { href: '/staff', label: 'Queue', icon: ClipboardList, ownerOnly: false },
  { href: '/staff/menu', label: 'Menu', icon: Coffee, ownerOnly: false },
  { href: '/staff/stats', label: 'Stats', icon: BarChart3, ownerOnly: false },
  { href: '/staff/settings', label: 'Settings', icon: Settings, ownerOnly: true },
];

/**
 * The header on phones, where the tablet one is far too wide (it made every
 * staff page scroll sideways). A slim top bar keeps what staff reach for during
 * service (customer screen, what's new); the rest is under "More". The pages
 * are tabs along the bottom, within reach of a thumb.
 */
function PhoneNav({
  cafe,
  cafeId,
  isOwner,
  onFullScreen,
  onSignOut,
  isPhone,
  locationIds,
}: {
  cafe: Cafe;
  cafeId: string | null;
  isOwner: boolean;
  onFullScreen: () => void;
  onSignOut: () => void;
  /** True below md: only then does this header run What's new (it opens itself) and look up locations. */
  isPhone: boolean;
  /** The owner's locations (v1.4), for switching from the More menu. */
  locationIds: string[];
}) {
  const pathname = usePathname();
  const firestore = useFirestore();
  const { user } = useUser();
  const [passcodeOpen, setPasscodeOpen] = useState(false);
  const tabs = TABS.filter((tab) => isOwner || !tab.ownerOnly);
  // The tablet header's location switcher doesn't fit on a phone, so owners of
  // two or more locations switch from the More menu instead.
  const owned = useOwnedLocations(isOwner && isPhone ? locationIds : []);
  const canSwitch = isOwner && user != null && owned != null && owned.length >= 2;

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm md:hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          <Logo className="h-9 w-9 flex-shrink-0" />
          <span className="min-w-0 flex-1 truncate text-xl">{cafe.location || 'Sixth Hour Cafe'}</span>
          <CustomerScreenButton slug={cafe.slug} />
          {isPhone && <WhatsNew />}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="More">
                <MoreHorizontal className="h-7 w-7" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {canSwitch && (
                <>
                  <DropdownMenuLabel className="text-base">Your locations</DropdownMenuLabel>
                  {owned.map((location) => (
                    <DropdownMenuItem
                      key={location.id}
                      className="gap-3 py-3 text-lg"
                      onSelect={() => {
                        if (location.id !== cafeId) switchLocation(firestore, user.uid, location.id);
                      }}
                    >
                      <Check className={cn('h-5 w-5 flex-shrink-0', location.id !== cafeId && 'opacity-0')} />
                      <span className="truncate">{location.name}</span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem asChild className="gap-3 py-3 text-lg">
                    <Link href="/onboarding?add=1">
                      <Plus className="h-5 w-5" /> Add another location
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {!isOwner && cafeId && (
                <DropdownMenuItem className="gap-3 py-3 text-lg" onSelect={() => setPasscodeOpen(true)}>
                  <KeyRound className="h-5 w-5" /> Staff passcode
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild className="gap-3 py-3 text-lg">
                <Link href="/guide">
                  <CircleHelp className="h-5 w-5" /> How to use the app
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-3 py-3 text-lg" onSelect={onFullScreen}>
                <Maximize className="h-5 w-5" /> Full screen
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-3 py-3 text-lg" onSelect={onSignOut}>
                <LogOut className="h-5 w-5" /> {isOwner ? 'Sign out' : 'Leave location'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {!isOwner && cafeId && (
        <StaffPasscodeDialog cafeId={cafeId} open={passcodeOpen} onOpenChange={setPasscodeOpen} />
      )}

      <nav
        aria-label="Pages"
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-0.5 py-2 text-base transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className={cn('rounded-full px-4 py-1', active && 'bg-primary/15')}>
                  <Icon className="h-6 w-6" />
                </span>
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { cafeId, role, passcodeVersion, locationIds, loading: isResolving } = useResolveCafe();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const isMobile = useIsMobile();
  useWakeLock();

  const cafeRef = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return cafeDoc(firestore, cafeId);
  }, [firestore, cafeId]);

  const { data: cafe } = useDoc<Cafe>(cafeRef);

  // Auth gate: only signed-in users may stay here. The main page has both the
  // staff passcode sign-in and the link to the owner login.
  useEffect(() => {
    if (isUserLoading) return;
    if (!user || user.isAnonymous) {
      router.replace('/');
    }
  }, [user, isUserLoading, router]);

  // A signed-in account that doesn't own a location must onboard.
  useEffect(() => {
    if (isUserLoading || isResolving) return;
    if (user && !user.isAnonymous && role === null) {
      router.replace('/onboarding');
    }
  }, [user, isUserLoading, isResolving, role, router]);

  // The owner changed the passcode: this staff device's sign-in no longer works, so
  // sign it out rather than let every screen fail.
  const passcodeChanged = role === 'staff' && cafe != null && passcodeVersionOf(cafe) !== passcodeVersion;
  useEffect(() => {
    if (!passcodeChanged) return;
    signOut(auth).then(() => {
      toast({
        title: 'The staff passcode was changed',
        description: 'Ask your location owner for the new passcode to sign back in.',
      });
      router.replace('/');
    });
  }, [passcodeChanged, auth, router]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace(role === 'staff' ? '/' : '/login');
  };

  // Block rendering until we've confirmed a valid member with a loaded cafe.
  // `cafe.id !== cafeId` covers the moment after an owner switches location,
  // before the new one has loaded.
  if (isUserLoading || isResolving || !user || user.isAnonymous || !cafe || cafe.id !== cafeId || passcodeChanged) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isOwner = role === 'owner';

  if (isFullScreen) {
    return (
      <CafeProvider key={cafeId} cafeId={cafeId} role={role}>
        <div className="relative">
            <Button
                variant="secondary"
                size="icon"
                onClick={() => setIsFullScreen(false)}
                className="absolute top-4 right-4 z-20 h-14 w-14 rounded-full shadow-lg"
                aria-label="Exit full screen"
            >
                <Minimize className="w-8 h-8"/>
            </Button>
            <main className="flex-1">
                {children}
            </main>
        </div>
      </CafeProvider>
    );
  }

  return (
    <CafeProvider key={cafeId} cafeId={cafeId} role={role}>
    <div className="flex flex-col min-h-screen">
      {/* Phones: a slim top bar and tabs along the bottom (see PhoneNav). */}
      <PhoneNav
        cafe={cafe}
        cafeId={cafeId}
        isOwner={isOwner}
        onFullScreen={() => setIsFullScreen(true)}
        onSignOut={handleSignOut}
        isPhone={isMobile}
        locationIds={locationIds}
      />
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b hidden md:block">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Logo className="w-12 h-12" />
            <h1 className="text-3xl hidden sm:block">
              Sixth Hour Cafe
              {cafe.location && (
                <span className="text-muted-foreground"> — {cafe.location}</span>
              )}
            </h1>
            {isOwner && cafeId && !isMobile && (
              <LocationSwitcher cafeId={cafeId} currentName={cafe.location} locationIds={locationIds} />
            )}
          </div>
          <nav className="flex items-center gap-2 sm:gap-4 p-1 bg-secondary rounded-lg">
            <NavLink href="/staff">Queue</NavLink>
            <NavLink href="/staff/menu">Menu</NavLink>
            <NavLink href="/staff/stats">Stats</NavLink>
            {isOwner && <NavLink href="/staff/settings">Settings</NavLink>}
          </nav>
          <div className="flex items-center gap-2">
            <CustomerScreenButton slug={cafe.slug} />
            {!isOwner && cafeId && <StaffPasscodeButton cafeId={cafeId} />}
            {/* One What's new at a time: it opens itself when there is news. */}
            {!isMobile && <WhatsNew />}
            <Button variant="ghost" size="icon" asChild>
              <Link href="/guide" aria-label="How to use the app" title="How to use the app">
                <CircleHelp className="w-7 h-7" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsFullScreen(true)} aria-label="Enter full screen">
                <Maximize className="w-8 h-8"/>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              aria-label={isOwner ? 'Sign out' : 'Leave location'}
              title={isOwner ? 'Sign out' : 'Leave location (you’ll need the passcode to come back)'}
            >
                <LogOut className="w-7 h-7"/>
            </Button>
          </div>
        </div>
      </header>
      {/* Room for the phone tab bar, so it never covers the last order. */}
      <main className="flex-1 pb-24 md:pb-0">
        {children}
      </main>
    </div>
    </CafeProvider>
  );
}
