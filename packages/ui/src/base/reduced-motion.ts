'use client';

import { useReducedMotion, useReducedMotionConfig } from 'motion/react';

/**
 * True when motion should be reduced: the device setting, or a
 * <MotionConfig reducedMotion="always"> around the component (harness, tests).
 * design-and-motion.md: under reduced motion, no movement.
 */
export function useShouldReduceMotion(): boolean {
  const device = useReducedMotion() ?? false;
  const config = useReducedMotionConfig() ?? false;
  return device || config;
}
