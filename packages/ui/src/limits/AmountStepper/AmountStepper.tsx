'use client';

import { formatOkrw } from '@sikyeoyong/shared';
import { useId } from 'react';
import { Amount } from '../../base/Amount';
import { Button } from '../../base/Button';
import styles from './AmountStepper.module.css';

export interface AmountStepperProps {
  /** What the amount is for ("한 번에 쓸 돈", "30일에 쓸 돈"). Also names the group and buttons. */
  readonly label: string;
  /** aokrw shown now. Expected on a step from min (shared isInRange). */
  readonly value: bigint;
  /** aokrw range and step (shared AmountRange, D-31). */
  readonly min: bigint;
  readonly max: bigint;
  readonly step: bigint;
  /** The next amount, always inside min and max. Saving is the parent's job. */
  readonly onChange: (value: bigint) => void;
}

/** Draws one labeled "− amount +" row that moves an amount by a step (AmountStepper.md). */
export function AmountStepper({ label, value, min, max, step, onChange }: AmountStepperProps) {
  const titleId = useId();
  const atMin = value <= min;
  const atMax = value >= max;
  const stepText = formatOkrw(step);
  const set = (next: bigint) => {
    onChange(next < min ? min : next > max ? max : next);
  };
  return (
    <div className={styles.stepper}>
      <span id={titleId} className={styles.title}>
        {label}
      </span>
      <div role="group" aria-labelledby={titleId} className={styles.box}>
        <Button
          variant="soft"
          size="round"
          label={`${label} ${stepText} 내리기`}
          disabled={atMin}
          onPress={() => {
            set(value - step);
          }}
        >
          −
        </Button>
        <output aria-live="polite" className={styles.value}>
          <Amount value={value} size="inherit" animate />
        </output>
        <Button
          variant="soft"
          size="round"
          label={`${label} ${stepText} 올리기`}
          disabled={atMax}
          onPress={() => {
            set(value + step);
          }}
        >
          +
        </Button>
      </div>
    </div>
  );
}
