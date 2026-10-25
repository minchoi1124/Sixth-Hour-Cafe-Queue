'use client';

import { useEffect } from 'react';

/**
 * Keep the screen on while the page is open, so a kiosk iPad doesn't dim or
 * lock mid-service. The browser drops the lock whenever the page is hidden, so
 * it's requested again each time the page becomes visible. Browsers without
 * the Screen Wake Lock API simply keep their normal sleep behaviour.
 */
export function useWakeLock() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        const next = await navigator.wakeLock.request('screen');
        if (cancelled) {
          next.release();
        } else {
          lock = next;
        }
      } catch {
        // Denied (e.g. low battery mode); the screen sleeps as usual.
      }
    };

    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', request);
      lock?.release();
    };
  }, []);
}
