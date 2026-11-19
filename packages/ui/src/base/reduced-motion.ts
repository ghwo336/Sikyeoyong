'use client';

import { useReducedMotion, useReducedMotionConfig } from 'motion/react';

/**
 * True when motion should be reduced: the device setting, or a
 * <MotionConfig reducedMotion="always"> around the component (harness, tests).
 * "always" can force it on; nothing forces it off, so the device setting is
 * always respected (MotionConfig "never" does not override the user).
 * design-and-motion.md: under reduced motion, no movement.
 */
export function useShouldReduceMotion(): boolean {
  const device = useReducedMotion() ?? false;
  const config = useReducedMotionConfig() ?? false;
  return device || config;
}
