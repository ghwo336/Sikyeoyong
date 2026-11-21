'use client';

import { AmountStepper } from '@sikyeoyong/ui';
import type { LimitDraft } from '../draft';

/**
 * The two amount steppers Budget.dc.html draws (sign-up and the wallet's limit screen): one
 * order, and 30 days. The 30-day one cannot go below the per-order one (D-31, `limitDraft`).
 */
export function LimitSteppers({
  draft,
  onPerOrder,
  onMyPeriodic,
}: {
  readonly draft: LimitDraft;
  readonly onPerOrder: (value: bigint) => void;
  readonly onMyPeriodic: (value: bigint) => void;
}) {
  return (
    <>
      <AmountStepper
        label="한 번에 쓸 돈"
        value={draft.perOrder}
        min={draft.perOrderRange.min}
        max={draft.perOrderRange.max}
        step={draft.perOrderRange.step}
        onChange={onPerOrder}
      />
      <AmountStepper
        label="30일에 쓸 돈"
        value={draft.myPeriodic}
        min={draft.periodicRange.min}
        max={draft.periodicRange.max}
        step={draft.periodicRange.step}
        onChange={onMyPeriodic}
      />
    </>
  );
}
