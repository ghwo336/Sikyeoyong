import { formatOkrw } from '@sikyeoyong/shared';
import styles from './Meter.module.css';

export type MeterTone = 'normal' | 'warn' | 'over';
export type MeterSize = 'sm' | 'md';

export interface MeterProps {
  /** aokrw spent so far. */
  readonly value: bigint;
  /** aokrw limit. */
  readonly max: bigint;
  /** Visible label ("이번 달 배달비"). */
  readonly label: string;
  /** Chosen by the parent (nagStage); the meter only paints it (Meter.md). */
  readonly tone: MeterTone;
  /** sm: Main card, 13px, gap 8. md: Arrived, 14px, gap 12. Default sm. */
  readonly size?: MeterSize;
}

/**
 * Fill width in hundredths of a percent, from bigint math only.
 * A value over max still fills 100%. max 0 is full when anything was spent.
 */
export function fillBasisPoints(value: bigint, max: bigint): number {
  if (max <= 0n) return value > 0n ? 10_000 : 0;
  if (value <= 0n) return 0;
  if (value >= max) return 10_000;
  return Number((value * 10_000n) / max);
}

/** Draws the current value against a limit as a bar (Meter.md). */
export function Meter({ value, max, label, tone, size = 'sm' }: MeterProps) {
  const bps = fillBasisPoints(value, max);
  const percent = bps / 100; // display only, never money
  const valueText = formatOkrw(value);
  const maxText = formatOkrw(max);
  return (
    <div className={`${styles.meter} ${styles[size]}`}>
      <div className={styles.row} aria-hidden="true">
        <span className={styles.label}>{label}</span>
        <span className={styles.numbers}>
          <span className={styles.value}>{valueText.replace(/원$/, '')}</span>
          <span className={styles.max}> / {maxText}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${valueText} / ${maxText}`}
        className={styles.track}
      >
        <div className={styles.fill} data-tone={tone} style={{ width: `${String(percent)}%` }} />
      </div>
    </div>
  );
}
