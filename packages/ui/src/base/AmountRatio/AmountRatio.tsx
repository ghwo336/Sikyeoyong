import { formatOkrw } from '@sikyeoyong/shared';
import { Amount } from '../Amount';
import styles from './AmountRatio.module.css';

/**
 * meter: inherits the meter's text size, value 600 ink, "/ max" regular secondary (Main, Confirm).
 * blocked: the amount large in amber, "/ max" 16px secondary, wrapping centered (Blocked).
 */
export type AmountRatioSize = 'meter' | 'blocked';

export interface AmountRatioProps {
  /** aokrw used or wanted. */
  readonly value: bigint;
  /** aokrw limit. */
  readonly max: bigint;
  readonly size: AmountRatioSize;
  /** false drops 원 after the value so the unit shows once (Meter). Default true. */
  readonly valueUnit?: boolean;
  /** Words after the max ("까지" on Blocked). */
  readonly suffix?: string;
}

/** Draws "value / max" for two amounts, both through formatOkrw (AmountRatio.md). */
export function AmountRatio({ value, max, size, valueUnit = true, suffix = '' }: AmountRatioProps) {
  return (
    <span className={`${styles.ratio} ${styles[size]}`}>
      <span className={styles.value}>
        <Amount value={value} size="inherit" unit={valueUnit} />
      </span>
      <span className={styles.max}>
        {' / '}
        {formatOkrw(max)}
        {suffix}
      </span>
    </span>
  );
}
