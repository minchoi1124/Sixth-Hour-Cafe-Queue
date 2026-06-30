'use client';

import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Maximize, Minimize, LogOut, Link2, Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  useAuth,
  useUser,
  useDoc,
  useFirestore,
  useMemoFirebase,
} from '@/firebase';
import { cafeDoc } from '@/lib/cafe-paths';
import type { Cafe } from '@/lib/definitions';
import { toast } from '@/hooks/use-toast';

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

function CustomerLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const url = `${window.location.origin}/order/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: 'Link copied', description: url });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy link' });
    }
  };

  return (
    <Button variant="outline" onClick={handleCopy} className="gap-2" title="Copy the ordering page link to open on your customer-facing device">
      {copied ? <Check className="h-5 w-5 text-green-500" /> : <Link2 className="h-5 w-5" />}
      <span className="hidden md:inline">Customer screen</span>
    </Button>
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
  const [isFullScreen, setIsFullScreen] = useState(false);

  const cafeRef = useMemoFirebase(() => {
    if (!firestore || !user || user.isAnonymous) return null;
    return cafeDoc(firestore, user.uid);
  }, [firestore, user]);

  const { data: cafe, isLoading: isCafeLoading } = useDoc<Cafe>(cafeRef);

  // Auth gate: only real (non-anonymous) owners may stay here.
  useEffect(() => {
    if (isUserLoading) return;
    if (!user || user.isAnonymous) {
      router.replace('/login');
    }
  }, [user, isUserLoading, router]);

  // Onboarding gate: a signed-in owner with no cafe doc must finish setup.
  useEffect(() => {
    if (isUserLoading || isCafeLoading) return;
    if (user && !user.isAnonymous && cafeRef && cafe === null) {
      router.replace('/onboarding');
    }
  }, [user, isUserLoading, isCafeLoading, cafe, cafeRef, router]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  // Block rendering of owner content until we've confirmed a valid owner + cafe.
  if (isUserLoading || isCafeLoading || !user || user.isAnonymous || !cafe) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isFullScreen) {
    return (
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
    );
  }

  return (
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
          </nav>
          <div className="flex items-center gap-2">
            <CustomerLinkButton slug={cafe.slug} />
            <Button variant="ghost" size="icon" onClick={() => setIsFullScreen(true)} aria-label="Enter full screen">
                <Maximize className="w-8 h-8"/>
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/order/${cafe.slug}`} aria-label="Go to customer page">
                  <Home className="w-8 h-8"/>
              </Link>
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
  );
}
