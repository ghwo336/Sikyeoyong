'use client';

import { formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import {
  Button,
  ErrorLine,
  LimitChangeCard,
  LoadingShape,
  RetryLine,
  TopBar,
} from '@sikyeoyong/ui';
import { useState } from 'react';
import { useTransitionRouter } from '../../../lib/transition-router';
import { useBudget } from '../../budget/hooks/useBudget';
import { limitsBody, raisesLimit } from '../draft';
import { useLimitDraft } from '../hooks/useLimitDraft';
import { useSetLimits } from '../hooks/useSetLimits';
import { LimitSteppers } from './LimitSteppers';

/**
 * The wallet's "한 번에 쓸 돈" and "30일에 쓸 돈" rows open this (no design of its own, web.md
 * "시안에 없는 것"): Budget's two steppers without the sign-up words. Lowering is saved at once;
 * raising first shows the change card with the re-auth button (D-28, like Blocked's raise)
 * under the steppers, which stay (QA: the top used to empty out, and the title said twice).
 * One order stays at or under 30 days (D-31). Paying is never involved (CLAUDE.md rule 3).
 */
export function LimitEditContainer() {
  const router = useTransitionRouter();
  const budgetQuery = useBudget();
  const budget = budgetQuery.data;
  const { draft, setPerOrder, setMyPeriodic } = useLimitDraft(budget);
  const save = useSetLimits();
  // After pressing "바꾸기" on a raise: the card with the re-auth step shows under the steppers.
  const [confirming, setConfirming] = useState(false);
  const toWallet = () => {
    router.replace('/dragon');
  };
  if (!budget && budgetQuery.isError) {
    return (
      <>
        <TopBar title="한도 바꾸기" onBack={toWallet} />
        <RetryLine
          onRetry={() => {
            void budgetQuery.refetch();
          }}
        >
          한도를 못 불러왔어요
        </RetryLine>
      </>
    );
  }
  if (!budget || !draft) {
    return (
      <>
        <TopBar title="한도 바꾸기" onBack={toWallet} />
        <LoadingShape kind="rows" count={2} />
      </>
    );
  }
  const body = limitsBody(budget, draft);
  const changed = Object.keys(body).length > 0;
  const send = () => {
    if (save.isPending) return;
    save.mutate(body, { onSuccess: toWallet });
  };
  if (confirming && changed) {
    const perOrderFrom = parseAokrw(budget.perOrderLimit);
    const mineFrom = parseAokrw(budget.myPeriodicLimit);
    // The card names one field; the other one rides along as a row (the same two-limit change).
    const perOrderFirst = draft.perOrder !== perOrderFrom;
    const otherChanged = perOrderFirst
      ? draft.myPeriodic !== mineFrom
      : draft.perOrder !== perOrderFrom;
    const other = perOrderFirst
      ? { label: '30일에 쓸 돈', from: mineFrom, to: draft.myPeriodic }
      : { label: '한 번에 쓸 돈', from: perOrderFrom, to: draft.perOrder };
    return (
      <>
        <TopBar
          title="한도 바꾸기"
          onBack={() => {
            setConfirming(false);
          }}
        />
        {/* The steppers stay where they were, so the chosen values stay in view and the screen
            does not empty out; the card is the last block, at the bottom like any sign-up button. */}
        <LimitSteppers draft={draft} onPerOrder={setPerOrder} onMyPeriodic={setMyPeriodic} />
        <LimitChangeCard
          hideTitle
          field={perOrderFirst ? 'perOrder' : 'myPeriodic'}
          from={perOrderFirst ? perOrderFrom : mineFrom}
          to={perOrderFirst ? draft.perOrder : draft.myPeriodic}
          needsReauth
          rows={
            otherChanged
              ? [
                  {
                    label: other.label,
                    value: `${formatOkrw(other.from)}에서 ${formatOkrw(other.to)}으로`,
                  },
                ]
              : []
          }
          status={save.isError ? 'failed' : save.isPending ? 'confirming' : 'idle'}
          onConfirm={send}
          onCancel={() => {
            setConfirming(false);
          }}
        />
      </>
    );
  }
  return (
    <>
      <TopBar title="한도 바꾸기" onBack={toWallet} />
      <LimitSteppers draft={draft} onPerOrder={setPerOrder} onMyPeriodic={setMyPeriodic} />
      {save.isError ? <ErrorLine>한도를 못 바꿨어요. 다시 눌러 주세요.</ErrorLine> : null}
      <Button
        variant="primary"
        disabled={!changed}
        loading={save.isPending}
        onPress={() => {
          if (!changed) return;
          if (raisesLimit(budget, draft)) setConfirming(true);
          else send();
        }}
      >
        바꾸기
      </Button>
    </>
  );
}
