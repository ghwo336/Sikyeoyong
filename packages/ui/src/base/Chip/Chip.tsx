'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { PRESS_SCALE, PRESS_SPRING } from '../press';
import { useShouldReduceMotion } from '../reduced-motion';
import styles from './Chip.module.css';

export type ChipSize = 'sm' | 'lg' | 'tile';

export interface ChipProps {
  /**
   * Set when the chip is one choice of a group (Budget, Arrived): it becomes a radio
   * with aria-checked. Leave undefined for plain quick replies (Main).
   */
  readonly selected?: boolean;
  readonly onPress: () => void;
  readonly children: ReactNode;
  /**
   * sm: 36px pill, 14px (Main quick replies). lg: 52px choice, 16/600 (Budget).
   * tile: 52px, 15/400 (Arrived taste rating). Default sm.
   */
  readonly size?: ChipSize;
  /** Tabular numbers for amounts (Budget "num" chips). */
  readonly numeric?: boolean;
  /** Set by radio groups (base/radio-group.ts) so Tab enters the group once. */
  readonly tabIndex?: number;
}

const PRESS = { scale: PRESS_SCALE };

/** Draws one small pill button that can be picked (Chip.md). The group rule lives in the parent. */
export function Chip({
  selected,
  onPress,
  children,
  size = 'sm',
  numeric = false,
  tabIndex,
}: ChipProps) {
  const reduceMotion = useShouldReduceMotion();
  const choice = selected !== undefined;
  return (
    <motion.button
      type="button"
      role={choice ? 'radio' : undefined}
      aria-checked={choice ? selected : undefined}
      className={`${styles.chip} ${styles[size]}${numeric ? ` ${styles.numeric}` : ''}`}
      data-selected={selected || undefined}
      tabIndex={tabIndex}
      whileTap={reduceMotion ? undefined : PRESS}
      transition={PRESS_SPRING}
      onClick={onPress}
    >
      {children}
    </motion.button>
  );
}
