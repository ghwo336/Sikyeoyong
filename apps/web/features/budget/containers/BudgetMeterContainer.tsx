'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { Meter } from '@sikyeoyong/ui';
import { useBudget } from '../hooks/useBudget';
import { BUDGET_TONE } from '../tone';

/** The 30-day spend against my 30-day limit on Main, in its white card (Main.dc.html, D-31). */
export function BudgetMeterContainer() {
  const { data } = useBudget();
  if (!data) return null;
  return (
    <Meter
      label="30일 배달비"
      value={parseAokrw(data.chainUsed)}
      max={parseAokrw(data.myPeriodicLimit)}
      tone={BUDGET_TONE[data.nagLevel]}
      framed
    />
  );
}
