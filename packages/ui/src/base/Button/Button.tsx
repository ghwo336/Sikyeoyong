'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { PRESS, PRESS_SPRING } from '../press';
import { useShouldReduceMotion } from '../reduced-motion';
import styles from './Button.module.css';

/**
 * primary: leaf fill. secondary: pale border. outline: ink border (Frozen "돌려받기").
 * text: plain secondary ink. link: leaf text, no box ("다시 보내기"). kakao: Kakao yellow.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'link' | 'kakao';
/**
 * lg: 56 full width. md: 44 pill, content width. sm: 44 touch, small text, content width.
 * choice: 52 full width (Blocked, LimitChat). tall: 64 full width, room for two lines (Blocked).
 */
export type ButtonSize = 'lg' | 'md' | 'sm' | 'choice' | 'tall';

export interface ButtonProps {
  readonly variant: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly icon?: ReactNode;
  readonly onPress: () => void;
  readonly children: ReactNode;
}

/** Draws one button that calls onPress. It does not decide what happens (Button.md). */
export function Button({
  variant,
  size = 'lg',
  loading = false,
  icon,
  onPress,
  children,
}: ButtonProps) {
  const reduceMotion = useShouldReduceMotion();
  return (
    <motion.button
      type="button"
      className={`${styles.button} ${styles[variant]} ${styles[size]}`}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      whileTap={loading || reduceMotion ? undefined : PRESS}
      transition={PRESS_SPRING}
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
