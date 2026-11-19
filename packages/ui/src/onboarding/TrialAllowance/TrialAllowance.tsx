'use client';

import { formatOkrw } from '@sikyeoyong/shared';
import { Button } from '../../base/Button';
import styles from './TrialAllowance.module.css';

/** idle: "받기" shows. pending: it is on its way. done: it arrived, no button any more. */
export type TrialAllowanceStatus = 'idle' | 'pending' | 'done';

export interface TrialAllowanceProps {
  /** aokrw the trial allowance gives. Shown with formatOkrw only. */
  readonly amount: bigint;
  readonly status: TrialAllowanceStatus;
  /** Asking for it is the parent's job. Called only while idle. */
  readonly onClaim: () => void;
}

/** Draws the trial allowance line: name, amount, and "받기" or that it arrived (TrialAllowance.md). */
export function TrialAllowance({ amount, status, onClaim }: TrialAllowanceProps) {
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <span className={styles.label}>체험용 용돈</span>
        <span className={styles.amount}>{formatOkrw(amount)}</span>
      </div>
      <div className={styles.end}>
        {status === 'done' ? null : (
          // Pending is a loading Button, which ignores presses, so only idle reaches onClaim.
          <Button variant="accent" size="md" loading={status === 'pending'} onPress={onClaim}>
            받기
          </Button>
        )}
        {/* Always mounted so screen readers hear the words when they appear. */}
        <span className={styles.done} aria-live="polite">
          {status === 'done' ? '받았어요' : null}
        </span>
      </div>
    </div>
  );
}
