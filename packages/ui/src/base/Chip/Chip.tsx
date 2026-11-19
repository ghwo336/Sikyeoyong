'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useShouldReduceMotion } from '../reduced-motion';
import styles from './Chip.module.css';

export type ChipSize = 'sm' | 'lg';

export interface ChipProps {
  /**
   * Set when the chip is one choice of a group (Budget, Arrived): it becomes a radio
   * with aria-checked. Leave undefined for plain quick replies (Main).
   */
  readonly selected?: boolean;
  readonly onPress: () => void;
  readonly children: ReactNode;
  /** sm: 36px pill (Main quick replies). lg: 52px tile (Budget, Arrived). Default sm. */
  readonly size?: ChipSize;
  /** Tabular numbers for amounts (Budget "num" chips). */
  readonly numeric?: boolean;
}

const PRESS = { scale: 0.97 };
const SPRING = { type: 'spring', damping: 18, stiffness: 300 } as const;

/** Draws one small pill button that can be picked (Chip.md). The group rule lives in the parent. */
export function Chip({ selected, onPress, children, size = 'sm', numeric = false }: ChipProps) {
  const reduceMotion = useShouldReduceMotion();
  const choice = selected !== undefined;
  return (
    <motion.button
      type="button"
      role={choice ? 'radio' : undefined}
      aria-checked={choice ? selected : undefined}
      className={`${styles.chip} ${styles[size]}${numeric ? ` ${styles.numeric}` : ''}`}
      data-selected={selected || undefined}
      whileTap={reduceMotion ? undefined : PRESS}
      transition={SPRING}
      onClick={onPress}
    >
      {children}
    </motion.button>
  );
}
