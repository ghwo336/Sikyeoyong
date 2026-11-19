'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'kakao';
export type ButtonSize = 'lg' | 'md';

export interface ButtonProps {
  readonly variant: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly icon?: ReactNode;
  readonly onPress: () => void;
  readonly children: ReactNode;
}

// design-and-motion.md: press is a 0.97 spring (tokens.json motion.press).
const PRESS = { scale: 0.97 };
const SPRING = { type: 'spring', damping: 18, stiffness: 300 } as const;

/** Draws one button that calls onPress. It does not decide what happens (Button.md). */
export function Button({
  variant,
  size = 'lg',
  loading = false,
  icon,
  onPress,
  children,
}: ButtonProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      className={`${styles.button} ${styles[variant]} ${styles[size]}`}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      whileTap={loading || reduceMotion ? undefined : PRESS}
      transition={SPRING}
      onClick={() => {
        if (!loading) onPress();
      }}
    >
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className={styles.label}>{children}</span>
    </motion.button>
  );
}
