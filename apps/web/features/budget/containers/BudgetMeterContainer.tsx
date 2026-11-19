'use client';

import { type NagStage, parseAokrw } from '@sikyeoyong/shared';
import { Meter, type MeterTone } from '@sikyeoyong/ui';
import { useBudget } from '../hooks/useBudget';

/** Meter paints what the server judged (nagLevel); it does not compare amounts itself. */
const TONE: { readonly [S in NagStage]: MeterTone } = {
  none: 'normal',
  warn70: 'warn',
  warn90: 'warn',
  over100: 'over',
};

/** This month's delivery budget bar on Main (Main.dc.html). */
export function BudgetMeterContainer() {
  const { data } = useBudget();
  if (!data) return null;
  return (
    <Meter
      label="이번 달 배달비"
      value={parseAokrw(data.personalSpent)}
      max={parseAokrw(data.personalBudget)}
      tone={TONE[data.nagLevel]}
    />
  );
}
