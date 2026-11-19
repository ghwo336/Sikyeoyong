'use client';

import { formatOkrw } from '@sikyeoyong/shared';
import { motion } from 'motion/react';
import { useShouldReduceMotion } from '../reduced-motion';
import styles from './Amount.module.css';

/** inherit: the parent's text size (AmountChange, AmountRatio set it per screen). */
export type AmountSize = 'display' | 'title' | 'row' | 'inherit';

export interface AmountProps {
  /** aokrw. Display goes through formatOkrw only (architecture.md). */
  readonly value: bigint;
  readonly size: AmountSize;
  /** Roll each digit when the value changes. Ignored under reduced motion. */
  readonly animate?: boolean;
  /** false drops the trailing 원 ("9,000 / 10,000원" shows the unit once). Default true. */
  readonly unit?: boolean;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
// tokens.json motion.number: digits roll, 400ms.
const ROLL = { duration: 0.4, ease: 'easeOut' } as const;

/** Draws an amount; when it changes, each digit rolls to its new value (Amount.md). */
export function Amount({ value, size, animate = false, unit = true }: AmountProps) {
  const reduceMotion = useShouldReduceMotion();
  const text = unit ? formatOkrw(value) : formatOkrw(value).replace(/원$/, '');
  const className = `${styles.amount} ${styles[size]}`;

  if (!animate || reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  // Key digits from the right so the ones place keeps its column when the length changes.
  const chars = Array.from(text); // ASCII digits, comma and 원 only (formatOkrw)
  return (
    <span className={className}>
      <span className={styles.srOnly}>{text}</span>
      <span className={styles.roll} aria-hidden="true">
        {chars.map((ch, i) => {
          const fromRight = chars.length - i;
          const digit = DIGITS.indexOf(ch as (typeof DIGITS)[number]);
          if (digit < 0) {
            return (
              <span key={`s${fromRight}`} className={styles.static}>
                {ch}
              </span>
            );
          }
          return (
            <span key={`d${fromRight}`} className={styles.window}>
              <motion.span
                className={styles.column}
                initial={false}
                animate={{ y: `${-digit}em` }}
                transition={ROLL}
              >
                {DIGITS.map((d) => (
                  <span key={d} className={styles.cell}>
                    {d}
                  </span>
                ))}
              </motion.span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
