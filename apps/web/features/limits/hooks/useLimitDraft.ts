'use client';

import type { BudgetView } from '@sikyeoyong/shared';
import { useState } from 'react';
import { type LimitDraft, limitDraft } from '../draft';

/** The two steppers' picks on top of the saved limits (undefined until the budget arrives). */
export function useLimitDraft(budget: BudgetView | undefined): {
  readonly draft: LimitDraft | undefined;
  readonly setPerOrder: (value: bigint) => void;
  readonly setMyPeriodic: (value: bigint) => void;
} {
  const [perOrder, setPerOrder] = useState<bigint | undefined>(undefined);
  const [myPeriodic, setMyPeriodic] = useState<bigint | undefined>(undefined);
  return {
    draft: budget === undefined ? undefined : limitDraft(budget, { perOrder, myPeriodic }),
    setPerOrder,
    setMyPeriodic,
  };
}
