'use client';

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

// The app's blue, plus bright ones so it reads as a party.
const COLORS = [
  'hsl(var(--primary))',
  '#60a5fa',
  '#f59e0b',
  '#ec4899',
  '#10b981',
];

/**
 * A short burst of confetti falling over the screen: shown once when a
 * customer's order goes in. It never takes taps (the "Tap to order" button
 * under it keeps working) and is skipped for "Reduce motion".
 */
export function Confetti({ pieces = 32 }: { pieces?: number }) {
  const reduce = useReducedMotion();
  // Random once per burst, so pieces don't jump around on re-render.
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        drift: (Math.random() - 0.5) * 160,
        spin: (Math.random() - 0.5) * 720,
        delay: Math.random() * 0.25,
        duration: 1.4 + Math.random() * 0.8,
        size: 7 + Math.random() * 7,
        round: Math.random() < 0.35,
        color: COLORS[i % COLORS.length],
      })),
    [pieces],
  );

  if (reduce) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {bits.map((bit) => (
        <motion.span
          key={bit.id}
          className="absolute top-0 block"
          style={{
            left: `${bit.left}%`,
            width: bit.size,
            height: bit.round ? bit.size : bit.size * 0.45,
            borderRadius: bit.round ? '9999px' : '2px',
            backgroundColor: bit.color,
          }}
          initial={{ y: '-10vh', x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '105vh', x: bit.drift, rotate: bit.spin, opacity: [1, 1, 0] }}
          transition={{ duration: bit.duration, delay: bit.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}
