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
            <Skeleton height="block" blockHeight="18px" width="6em" />
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
          <Skeleton height="block" blockHeight="64px" width="60%" />
          <Skeleton height="block" blockHeight="var(--size-step-md)" width="100%" />
          <Skeleton height="block" blockHeight="160px" width="100%" />
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
          <Skeleton height="block" blockHeight="120px" width="100%" />
        </div>
      );
  }
}
