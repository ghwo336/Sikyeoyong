'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { PRESS, PRESS_SPRING } from '../press';
import { useShouldReduceMotion } from '../reduced-motion';
import styles from './Button.module.css';

/**
 * primary: leaf fill. secondary: pale border. outline: ink border (Frozen "돌려받기").
 * accent: leaf border and leaf text on white (Budget "받기"). soft: pale fill, no line
 * (Budget "−" and "+").
 * text: plain secondary ink. link: leaf text, no box ("다시 보내기"). kakao: Kakao yellow.
 */
export type ButtonVariant =
  'primary' | 'secondary' | 'outline' | 'accent' | 'soft' | 'text' | 'link' | 'kakao';
/**
 * lg: 56 full width. md: 44 pill, content width. sm: 44 touch, small text, content width.
 * choice: 52 full width (Blocked, LimitChat). tall: 64 full width, room for two lines (Blocked).
 * round: a 48 circle for one sign (Budget "−" and "+"); give it a `label`.
 */
export type ButtonSize = 'lg' | 'md' | 'sm' | 'choice' | 'tall' | 'round';

export interface ButtonProps {
  readonly variant: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly icon?: ReactNode;
  /**
   * Cannot be pressed now (Budget "−" at the lowest amount): faded, no press, no onPress.
   * aria-disabled, not the native attribute, so a keyboard press that reaches the end keeps focus.
   */
  readonly disabled?: boolean;
  /** The name for screen readers when the visible text is not one ("−" is "...내리기"). */
  readonly label?: string;
  readonly onPress: () => void;
  readonly children: ReactNode;
}

/** Draws one button that calls onPress. It does not decide what happens (Button.md). */
export function Button({
  variant,
  size = 'lg',
  loading = false,
  icon,
  disabled = false,
  label,
  onPress,
  children,
}: ButtonProps) {
  const reduceMotion = useShouldReduceMotion();
  return (
    <motion.button
      type="button"
      className={`${styles.button} ${styles[variant]} ${styles[size]}`}
      aria-busy={loading || undefined}
      aria-label={label}
      aria-disabled={disabled || undefined}
      data-loading={loading || undefined}
      whileTap={loading || disabled || reduceMotion ? undefined : PRESS}
      transition={PRESS_SPRING}
      onClick={() => {
        if (!loading && !disabled) onPress();
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
