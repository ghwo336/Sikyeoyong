'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { LoadingShape, Meter, RetryLine } from '@sikyeoyong/ui';
import { useBudget } from '../hooks/useBudget';
import { BUDGET_TONE } from '../tone';

/** The 30-day spend against my 30-day limit on Main, in its white card (Main.dc.html, D-31). */
export function BudgetMeterContainer() {
  const { data, isError, refetch } = useBudget();
  // A failed read keeps its place with a small error line and a retry, so the Main screen
  // neither jumps nor loses the row without a word (D-23, QA 4).
  if (isError && !data) {
    return (
      <RetryLine
        onRetry={() => {
          void refetch();
        }}
      >
        30일 배달비를 못 불러왔어요
      </RetryLine>
    );
  }
  if (!data) return <LoadingShape kind="meter" />;
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
