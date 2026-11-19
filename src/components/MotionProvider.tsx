'use client';

import { MotionConfig } from 'framer-motion';

/**
 * Every framer-motion animation in the app follows the device's "Reduce
 * motion" setting: movement is dropped and things simply appear. (CSS
 * animations do the same through Tailwind's `motion-safe:`.)
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
