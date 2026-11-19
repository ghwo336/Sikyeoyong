'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { Meter } from '@sikyeoyong/ui';
import { useBudget } from '../hooks/useBudget';
import { BUDGET_TONE } from '../tone';

/** This month's delivery budget bar on Main (Main.dc.html). */
export function BudgetMeterContainer() {
  const { data } = useBudget();
  if (!data) return null;
  return (
    <Meter
      label="이번 달 배달비"
      value={parseAokrw(data.personalSpent)}
      max={parseAokrw(data.personalBudget)}
      tone={BUDGET_TONE[data.nagLevel]}
    />
  );
}
