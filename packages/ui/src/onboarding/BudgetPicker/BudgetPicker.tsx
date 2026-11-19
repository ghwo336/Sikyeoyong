'use client';

import { formatOkrw } from '@sikyeoyong/shared';
import { useId } from 'react';
import { Chip } from '../../base/Chip';
import { radioGroupKeyDown, radioTabIndex } from '../../base/radio-group';
import styles from './BudgetPicker.module.css';

export interface BudgetPickerProps {
  /** aokrw choices without duplicates (Budget.dc.html: 200,000, 300,000, 500,000). */
  readonly options: readonly bigint[];
  /** aokrw picked now. */
  readonly value: bigint;
  /** Saving is the parent's job. */
  readonly onChange: (value: bigint) => void;
}

/** Draws the month budget choices as chips (BudgetPicker.md). */
export function BudgetPicker({ options, value, onChange }: BudgetPickerProps) {
  const titleId = useId();
  const selected = options.findIndex((o) => o === value);
  return (
    <div className={styles.picker}>
      <p id={titleId} className={styles.title}>
        이번 달 배달 예산
      </p>
      <div
        className={styles.choices}
        role="radiogroup"
        aria-labelledby={titleId}
        onKeyDown={radioGroupKeyDown((i) => {
          const o = options[i];
          if (o !== undefined) onChange(o);
        })}
      >
        {options.map((o, i) => (
          <Chip
            key={o.toString()}
            size="lg"
            numeric
            selected={o === value}
            tabIndex={radioTabIndex(i, selected)}
            onPress={() => {
              onChange(o);
            }}
          >
            {/* formatOkrw only (architecture.md). The short "30만 원" waits for Q-23. */}
            {formatOkrw(o)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
