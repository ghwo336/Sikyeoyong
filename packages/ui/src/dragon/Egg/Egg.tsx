'use client';

import type { DragonSpecies } from '@sikyeoyong/shared';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useShouldReduceMotion } from '../../base/reduced-motion';
import styles from './Egg.module.css';

export type EggState = 'closed' | 'wobble' | 'sleeping';

export interface EggProps {
  readonly state: EggState;
  readonly species: DragonSpecies;
  /** Width and height in px (design: 120 in the dex, 168 on Frozen). */
  readonly size: number;
}

const SHELL = 'M32 6 C44 6 52 24 52 39 C52 52 43 60 32 60 C21 60 12 52 12 39 C12 24 20 6 32 6 Z';
// A small rock to each side and back, then rest (design-and-motion: transform only).
const WOBBLE = { rotate: [0, -7, 6, -4, 3, 0] };
const WOBBLE_TIMING = {
  duration: 1.2,
  repeat: Infinity,
  repeatDelay: 0.8,
  ease: 'easeInOut',
} as const;

// Egg patterns from design/screens/Dragons.dc.html (D-20).
function Pattern({ species }: { species: DragonSpecies }): ReactNode {
  switch (species) {
    case 'forest':
      return (
        <g data-part="egg-leaves" className={styles.mark}>
          <path d="M22 31 C19 28 20 24 24 24 C25 27 24 30 22 31 Z" />
          <path d="M40 44 C37 41 38 37 42 37 C43 40 42 43 40 44 Z" />
          <path d="M29 52 C27 50 28 47 30 47 C31 49 30 51 29 52 Z" />
          <path d="M38 21 C36 19 37 16 39 16 C40 18 39 20 38 21 Z" />
        </g>
      );
    case 'water':
      return (
        <g data-part="egg-waves" className={styles.wave}>
          <path d="M14.5 30 Q19 26.5 23.5 30 T32.5 30 T41.5 30 T50 29" />
          <path d="M13 42 Q18 38.5 23 42 T33 42 T43 42 T51.5 41" />
        </g>
      );
    case 'flower':
      return (
        <g data-part="egg-petals">
          <g className={styles.mark}>
            <circle cx="23" cy="29" r="2" />
            <circle cx="26.4" cy="29" r="2" />
            <circle cx="24.7" cy="26.4" r="2" />
            <circle cx="24.7" cy="31.6" r="2" />
            <circle cx="39" cy="43" r="2" />
            <circle cx="42.4" cy="43" r="2" />
            <circle cx="40.7" cy="40.4" r="2" />
            <circle cx="40.7" cy="45.6" r="2" />
            <circle cx="29" cy="51" r="1.4" />
            <circle cx="39" cy="21" r="1.4" />
          </g>
          <circle className={styles.yolk} cx="24.7" cy="29" r="1" />
          <circle className={styles.yolk} cx="40.7" cy="43" r="1" />
        </g>
      );
    case 'star':
      return (
        <g data-part="egg-stars" className={styles.mark}>
          <path d="M24 25 L25.2 28 L28.4 28.2 L25.9 30.2 L26.7 33.3 L24 31.5 L21.3 33.3 L22.1 30.2 L19.6 28.2 L22.8 28 Z" />
          <path d="M40 39 L41.2 42 L44.4 42.2 L41.9 44.2 L42.7 47.3 L40 45.5 L37.3 47.3 L38.1 44.2 L35.6 42.2 L38.8 42 Z" />
          <circle cx="30" cy="51" r="1.4" />
          <circle cx="38" cy="20" r="1.4" />
          <path data-part="egg-moon" d="M46 30 A4 4 0 1 1 42 26 A3 3 0 1 0 46 30 Z" />
        </g>
      );
  }
}

/** Draws the egg: closed, wobbling, or sleeping (Egg.md). Decorative: hidden from screen readers. */
export function Egg({ state, species, size }: EggProps) {
  const reduceMotion = useShouldReduceMotion();
  const wobbling = state === 'wobble' && !reduceMotion;
  return (
    <svg
      className={styles.egg}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      data-species={species}
      data-state={state}
      data-wobbling={wobbling || undefined}
    >
      <ellipse className={styles.shadow} cx="32" cy="61" rx="15" ry="2" />
      <motion.g
        style={{ originX: '50%', originY: '100%', transformBox: 'fill-box' }}
        animate={wobbling ? WOBBLE : { rotate: 0 }}
        transition={wobbling ? WOBBLE_TIMING : { duration: 0 }}
      >
        <path className={styles.shell} d={SHELL} />
        <Pattern species={species} />
      </motion.g>
      {state === 'sleeping' ? (
        <g data-part="zz">
          <path className={styles.zz} d="M44 10 H50 L44 16 H50" />
          <path className={styles.zzSmall} d="M53 3 H57 L53 7 H57" />
        </g>
      ) : null}
    </svg>
  );
}
