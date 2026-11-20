'use client';

import { motion } from 'motion/react';
import { PRESS_SPRING } from '../press';
import { useShouldReduceMotion } from '../reduced-motion';
import styles from './Switch.module.css';

export interface SwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** id of the visible label ("용이 멈추기"), read by screen readers (Wallet.dc.html). */
  readonly labelId: string;
}

// The knob stretches a little while pressed (Switch.md); the spring is tokens.json motion.press.
const THUMB_PRESS = { scaleX: 1.15 };

/** Draws one on/off switch (Switch.md). What turning it on does is the parent's callback. */
export function Switch({ checked, onChange, labelId }: SwitchProps) {
  const reduceMotion = useShouldReduceMotion();
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      className={styles.hit}
      whileTap="pressed"
      onClick={() => {
        onChange(!checked);
      }}
    >
      {/* The button is the 44px finger target; the track inside is what the eye sees. */}
      <span className={styles.track} aria-hidden="true">
        <motion.span
          className={styles.knob}
          variants={reduceMotion ? {} : { pressed: THUMB_PRESS }}
          transition={PRESS_SPRING}
        />
      </span>
    </motion.button>
  );
}
