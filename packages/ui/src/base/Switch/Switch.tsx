'use client';

import { motion } from 'motion/react';
import { useShouldReduceMotion } from '../reduced-motion';
import styles from './Switch.module.css';

export interface SwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** id of the visible label ("용이 멈추기"), read by screen readers (Wallet.dc.html). */
  readonly labelId: string;
}

// The knob stretches a little while pressed (Switch.md); the spring is tokens.json motion.press.
const PRESS = { scaleX: 1.15 };
const SPRING = { type: 'spring', damping: 18, stiffness: 300 } as const;

/** Draws one on/off switch (Switch.md). What turning it on does is the parent's callback. */
export function Switch({ checked, onChange, labelId }: SwitchProps) {
  const reduceMotion = useShouldReduceMotion();
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      className={styles.track}
      whileTap="pressed"
      onClick={() => {
        onChange(!checked);
      }}
    >
      <motion.span
        className={styles.knob}
        variants={reduceMotion ? {} : { pressed: PRESS }}
        transition={SPRING}
        aria-hidden="true"
      />
    </motion.button>
  );
}
