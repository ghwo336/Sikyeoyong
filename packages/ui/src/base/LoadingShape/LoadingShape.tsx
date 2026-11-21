import styles from './LoadingShape.module.css';
import { Skeleton } from '../Skeleton';

/** Which screen region the grey shape stands in for. */
export type LoadingShapeKind = 'chatHeader' | 'meter' | 'orderStatus' | 'rows' | 'detail';

export interface LoadingShapeProps {
  readonly kind: LoadingShapeKind;
  /** `rows` only: how many list rows (default 3). */
  readonly count?: number;
  /** Marks for the caller's tests (data-part). */
  readonly [data: `data-${string}`]: string | boolean | undefined;
}

const line = (size: string, lineHeight: string) => `${size} * ${lineHeight}`;

/**
 * Heights taken from the same tokens as the real parts' CSS, so a changed token moves the shape
 * with the part (LoadingShape.test.tsx reads those CSS files and checks each token is there).
 * OrderStatusHeader: a display line over a body line, one space-1 apart.
 */
export const ORDER_HEADER_HEIGHT = `calc(${line('var(--type-display-size)', 'var(--type-display-line-height)')} + var(--space-1) + ${line('var(--type-body-size)', 'var(--type-body-line-height)')})`;
/**
 * OrderSummary with one line: padding and border, then head, one body line, divider (1px and
 * its 2px margins) and total, three summary gaps between the four.
 */
export const SUMMARY_CARD_HEIGHT = `calc(var(--space-4) * 2 + 2px + ${line('var(--type-caption-size)', 'var(--type-body-line-height)')} + ${line('var(--type-body-size)', 'var(--type-body-line-height)')} + 5px + ${line('var(--type-total-size)', 'var(--type-body-line-height)')} + var(--size-summary-gap) * 3)`;

/**
 * Draws the still grey shape of a region while its data loads, as tall as the real thing so
 * nothing jumps when the data arrives (LoadingShape.md, D-23).
 */
export function LoadingShape({ kind, count = 3, ...data }: LoadingShapeProps) {
  // The parent says "busy" (aria-busy); the shape itself is silent.
  const common = { 'aria-hidden': true, 'data-shape': kind, ...data } as const;
  switch (kind) {
    case 'chatHeader':
      return (
        <div className={styles.chatHeader} {...common}>
          <Skeleton height="circle" width="var(--size-dragon-sheet)" />
          <div className={styles.chatText}>
            <Skeleton height="block" blockHeight="var(--type-heading-size)" width="6em" />
            <Skeleton height="caption" width="10em" />
          </div>
        </div>
      );
    case 'meter':
      return (
        <div className={styles.meter} {...common}>
          <div className={styles.meterRow}>
            <Skeleton height="caption" width="6em" />
            <Skeleton height="caption" width="5em" />
          </div>
          <Skeleton height="block" blockHeight="var(--size-meter)" width="100%" />
        </div>
      );
    case 'orderStatus':
      return (
        <div className={styles.stack} {...common}>
          <Skeleton height="block" blockHeight={ORDER_HEADER_HEIGHT} width="60%" />
          <Skeleton height="block" blockHeight="var(--size-step-md)" width="100%" />
          <Skeleton height="block" blockHeight={SUMMARY_CARD_HEIGHT} width="100%" />
        </div>
      );
    case 'rows':
      return (
        <div className={styles.rows} {...common}>
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className={styles.row}>
              <Skeleton height="caption" width="40%" />
              <Skeleton height="caption" width="20%" />
            </div>
          ))}
        </div>
      );
    case 'detail':
      return (
        <div className={styles.stack} {...common}>
          <Skeleton height="walletAmount" width="10em" />
          <Skeleton height="block" blockHeight={SUMMARY_CARD_HEIGHT} width="100%" />
        </div>
      );
  }
}
