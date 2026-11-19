'use client';

import { AOKRW_PER_OKRW, formatOkrw } from '@sikyeoyong/shared';
import { useId } from 'react';
import { Chip } from '../../base/Chip';
import { radioGroupKeyDown, radioTabIndex } from '../../base/radio-group';
import styles from './BudgetPicker.module.css';

export interface BudgetPickerProps {
  /** aokrw choices (Budget.dc.html: 200,000, 300,000, 500,000). */
  readonly options: readonly bigint[];
  /** aokrw picked now. */
  readonly value: bigint;
  /** Saving is the parent's job. */
  readonly onChange: (value: bigint) => void;
}

const MAN = 10_000n;

/**
 * "30만 원" for whole ten-thousands of won, the usual "123,456원" otherwise.
 * bigint only; the "만 원" form is open question Q-23.
 */
export function formatManWon(aokrw: bigint): string {
  if (aokrw > 0n && aokrw % (AOKRW_PER_OKRW * MAN) === 0n) {
    const man = aokrw / (AOKRW_PER_OKRW * MAN);
    return `${man.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}만 원`;
  }
  return formatOkrw(aokrw);
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
            {formatManWon(o)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
