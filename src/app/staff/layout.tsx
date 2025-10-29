'use client';

import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home } from 'lucide-react';
import { StaffPageWrapper } from './page';

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


export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const pathname = usePathname();
  const isStaffRoot = pathname === '/staff';

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="container mx-auto flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Logo className="w-12 h-12" />
            <h1 className="text-4xl hidden sm:block">Staff Panel</h1>
          </div>
          <nav className="flex items-center gap-2 sm:gap-4 p-1 bg-secondary rounded-lg">
            <NavLink href="/staff">Queue</NavLink>
            <NavLink href="/staff/menu">Menu</NavLink>
          </nav>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/" aria-label="Go to customer page">
                <Home className="w-8 h-8"/>
            </Link>
          </Button>
        </div>
      </header>
      <main className="flex-1">
        {isStaffRoot ? <StaffPageWrapper /> : children}
      </main>
    </div>
  );
}
