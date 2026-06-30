import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';

export default function CafeNotFound() {
  return (
    <main className="container mx-auto flex min-h-screen max-w-md flex-col items-center justify-center p-6 text-center">
      <Logo className="mb-6 h-20 w-20 opacity-70" />
      <h1 className="text-4xl font-bold">Cafe not found</h1>
      <p className="mt-3 text-lg text-muted-foreground">
        This ordering link doesn&apos;t exist. Double-check the link or QR code.
      </p>
      <Button asChild variant="outline" className="mt-8">
        <Link href="/">Go home</Link>
      </Button>
    </main>
  );
}
