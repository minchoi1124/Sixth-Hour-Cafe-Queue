import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase';
import localFont from 'next/font/local';

export const metadata: Metadata = {
  title: 'Sixth Hour Cafe Queue',
  description: 'Order your favorite drinks and see the queue.',
};

const providenceSans = localFont({
  src: [
    {
      path: '../../public/fonts/Providence Sans.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/Providence Sans Bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-providence-sans',
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Beth+Ellen&display=swap" rel="stylesheet" />
      </head>
      <body className={cn("font-headline antialiased min-h-screen", providenceSans.variable)}>
        <FirebaseClientProvider>
          {children}
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
