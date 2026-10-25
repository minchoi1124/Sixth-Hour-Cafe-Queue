'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Order } from '@/lib/definitions';

// Per device, so each iPad keeps its own setting.
const STORAGE_KEY = 'sixth-hour:order-chime';

/** Two short rising notes, synthesised so there's no audio file to load. */
function playChime(ctx: AudioContext) {
  const start = ctx.currentTime;
  [880, 1318.5].forEach((frequency, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const at = start + i * 0.18;
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.5);
  });
}

/**
 * Play a chime when an order appears in the pending queue. Orders present on
 * first load, and orders seen before (e.g. restored with Undo), stay silent.
 *
 * Browsers, iOS Safari especially, only allow audio after a tap, so sound is
 * unlocked by the tap that turns the chime on, or by the first tap on the page
 * when it was left on from an earlier visit.
 */
export function useNewOrderChime(orders: Order[] | null) {
  const [enabled, setEnabled] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const seenRef = useRef<Set<string> | null>(null);

  const unlock = useCallback(() => {
    ctxRef.current ??= new AudioContext();
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume().catch(() => {});
    }
  }, []);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(STORAGE_KEY) === 'on');
    } catch {
      // Storage unavailable; the chime starts off.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [enabled, unlock]);

  useEffect(() => {
    if (!orders) return;
    const seen = seenRef.current;
    const ids = orders.map((order) => order.id);
    if (!seen) {
      seenRef.current = new Set(ids);
      return;
    }
    const hasNew = ids.some((id) => !seen.has(id));
    ids.forEach((id) => seen.add(id));
    if (hasNew && enabled && ctxRef.current?.state === 'running') {
      playChime(ctxRef.current);
    }
  }, [orders, enabled]);

  const toggle = useCallback(() => {
    const next = !enabled;
    setEnabled(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
    } catch {
      // Not remembered across reloads; still works for this visit.
    }
    if (next) {
      unlock();
      // Confirms the sound works and the volume is up.
      if (ctxRef.current) playChime(ctxRef.current);
    }
  }, [enabled, unlock]);

  return { enabled, toggle };
}
