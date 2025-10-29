
'use client';

import { useState } from 'react';
import { getMenu } from '@/lib/data';
import OrderForm from '@/components/customer/OrderForm';
import { Logo } from '@/components/Logo';
import type { MenuItem } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Maximize, Minimize } from 'lucide-react';

export default function CustomerPageClient({ menu }: { menu: MenuItem[] }) {
  const [isFullScreen, setIsFullScreen] = useState(false);

  const handleToggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggleFullScreen}
        className="absolute top-4 right-4 z-20 h-14 w-14 rounded-full shadow-lg"
        aria-label={isFullScreen ? "Exit full screen" : "Enter full screen"}
      >
        {isFullScreen ? (
          <Minimize className="w-8 h-8" />
        ) : (
          <Maximize className="w-8 h-8" />
        )}
      </Button>
      <main className="container mx-auto max-w-2xl p-4 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Logo className="w-24 h-24 mb-4" />
          <h1 className="text-5xl md:text-6xl font-bold tracking-tighter">
            Sixth Hour Cafe
          </h1>
          <div className="mt-6 text-center">
            <blockquote className="text-2xl italic text-muted-foreground">
              “Come, see a man who told me everything I ever did.”
            </blockquote>
            <p className="text-right text-lg text-muted-foreground mt-1 pr-2">– John 4:29</p>
          </div>
          <p className="mt-4 text-2xl text-muted-foreground">
            This is where it all began.
          </p>
        </div>

        <div className="mt-12">
          <OrderForm menu={menu} />
        </div>
      </main>
    </>
  );
}
