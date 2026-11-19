import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Coffee, QrCode, ListChecks } from 'lucide-react';
import { StaffSignIn } from '@/components/StaffSignIn';
import { PasscodeAnnouncement } from '@/components/PasscodeAnnouncement';
import { listLocations } from '@/lib/data';
import { REVEAL_PARAM } from '@/lib/location-picker';

// The staff sign-in lists locations, so a new one shows up right away.
export const dynamic = 'force-dynamic';

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // /?location={slug} also lists that location if it's a hidden test one,
  // already picked (src/lib/location-picker.ts).
  const revealParam = (await searchParams)[REVEAL_PARAM];
  const reveal = typeof revealParam === 'string' ? revealParam : null;
  const locations = await listLocations(reveal);
  const preselectedId = reveal ? locations.find((location) => location.slug === reveal)?.id : undefined;

  return (
    <main className="container mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center p-4 text-center sm:p-6">
      <Logo className="mb-6 h-24 w-24" />
      <h1 className="text-5xl font-bold tracking-tighter md:text-6xl">
        Sixth Hour Cafe
      </h1>
      <p className="mt-4 max-w-xl text-xl text-muted-foreground">
        The real-time ordering queue for every Sixth Hour Cafe location. Customers
        order on one screen, you work the queue on another, and your menu stays in
        sync.
      </p>

      <div className="mt-8 w-full max-w-md">
        <StaffSignIn locations={locations} preselectedId={preselectedId} />
      </div>
      <div className="mt-3">
        <PasscodeAnnouncement />
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <p className="text-lg text-muted-foreground">Own a location?</p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button asChild variant="outline" className="text-xl" size="lg">
            <Link href="/login">Owner log in</Link>
          </Button>
          <Button asChild variant="ghost" className="text-xl" size="lg">
            <Link href="/login">Start a new location</Link>
          </Button>
        </div>
      </div>
      <Link href="/guide" className="mt-4 text-lg text-muted-foreground underline">
        How does it work?
      </Link>

      <div className="mt-16 grid w-full grid-cols-1 gap-8 sm:grid-cols-3">
        <Feature
          icon={<QrCode className="h-10 w-10 text-primary" />}
          title="Customer ordering screen"
          body="Open the order page on a customer-facing tablet, or share a link/QR — no app, no login."
        />
        <Feature
          icon={<ListChecks className="h-10 w-10 text-primary" />}
          title="Manage your menu"
          body="Add drinks, categories and modifications. Changes appear instantly."
        />
        <Feature
          icon={<Coffee className="h-10 w-10 text-primary" />}
          title="Work the queue"
          body="See pending orders in real time and mark them done as you go."
        />
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      {icon}
      <h2 className="text-2xl font-semibold">{title}</h2>
      <p className="text-muted-foreground">{body}</p>
    </div>
  );
}
