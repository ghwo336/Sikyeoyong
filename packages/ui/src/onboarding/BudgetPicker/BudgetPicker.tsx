'use client';

import { formatOkrw } from '@sikyeoyong/shared';
import { Chip } from '../../base/Chip';
import { ChoiceGroup } from '../../base/ChoiceGroup';

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
  return (
    <ChoiceGroup
      title="이번 달 배달 예산"
      layout="columns"
      options={options}
      value={value}
      onChange={onChange}
      keyOf={(o) => o.toString()}
      renderOption={(o, s) => (
        <Chip size="lg" numeric selected={s.selected} tabIndex={s.tabIndex} onPress={s.select}>
          {/* formatOkrw only (architecture.md). The short "30만 원" waits for Q-23. */}
          {formatOkrw(o)}
        </Chip>
      )}
    />
  );
}
