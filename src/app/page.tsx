import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Coffee, QrCode, ListChecks } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="container mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center p-6 text-center">
      <Logo className="mb-6 h-24 w-24" />
      <h1 className="text-5xl font-bold tracking-tighter md:text-6xl">
        Cafe Queue
      </h1>
      <p className="mt-4 max-w-xl text-xl text-muted-foreground">
        A simple, real-time ordering queue for your cafe. Customers order on one
        screen, you work the queue on another, and your menu stays in sync.
      </p>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <Button asChild className="text-xl" size="lg">
          <Link href="/login">Get started</Link>
        </Button>
        <Button asChild variant="outline" className="text-xl" size="lg">
          <Link href="/login">Log in</Link>
        </Button>
      </div>

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
