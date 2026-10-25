'use client';

import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Maximize, Minimize, LogOut, QrCode, Loader2 } from 'lucide-react';
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
import { useWakeLock } from '@/hooks/use-wake-lock';
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

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { cafeId, role, loading: isResolving } = useResolveCafe();
  const [isFullScreen, setIsFullScreen] = useState(false);
  useWakeLock();

  const cafeRef = useMemoFirebase(() => {
    if (!firestore || !cafeId) return null;
    return cafeDoc(firestore, cafeId);
  }, [firestore, cafeId]);

  const { data: cafe } = useDoc<Cafe>(cafeRef);

  // Auth gate: only signed-in users may stay here.
  useEffect(() => {
    if (isUserLoading) return;
    if (!user || user.isAnonymous) {
      router.replace('/login');
    }
  }, [user, isUserLoading, router]);

  // A signed-in user who is neither an owner nor staff must onboard or join.
  useEffect(() => {
    if (isUserLoading || isResolving) return;
    if (user && !user.isAnonymous && role === null) {
      router.replace('/onboarding');
    }
  }, [user, isUserLoading, isResolving, role, router]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  // Block rendering until we've confirmed a valid member with a loaded cafe.
  if (isUserLoading || isResolving || !user || user.isAnonymous || !cafe) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isOwner = role === 'owner';

  if (isFullScreen) {
    return (
      <CafeProvider cafeId={cafeId} role={role}>
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
    <CafeProvider cafeId={cafeId} role={role}>
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Logo className="w-12 h-12" />
            <h1 className="text-3xl hidden sm:block">
              Sixth Hour Cafe
              {cafe.location && (
                <span className="text-muted-foreground"> — {cafe.location}</span>
              )}
            </h1>
          </div>
          <nav className="flex items-center gap-2 sm:gap-4 p-1 bg-secondary rounded-lg">
            <NavLink href="/staff">Queue</NavLink>
            <NavLink href="/staff/menu">Menu</NavLink>
            <NavLink href="/staff/stats">Stats</NavLink>
            {isOwner && <NavLink href="/staff/settings">Settings</NavLink>}
          </nav>
          <div className="flex items-center gap-2">
            <CustomerScreenButton slug={cafe.slug} />
            <WhatsNew />
            <Button variant="ghost" size="icon" onClick={() => setIsFullScreen(true)} aria-label="Enter full screen">
                <Maximize className="w-8 h-8"/>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
                <LogOut className="w-7 h-7"/>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
    </CafeProvider>
  );
}
