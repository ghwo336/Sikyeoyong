'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { CapReached, TopBar } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useBudget } from '../../budget/hooks/useBudget';
import { useBackToChat } from '../hooks/useBackToChat';

/** Cap.dc.html: the 30-day cap is used up; when it refills (the chain's resetAt). */
export function CapContainer() {
  const router = useRouter();
  const budget = useBudget().data;
  // The time the screen opened: CapReached counts the days from it (kept pure, CapReached.md).
  const [now] = useState(() => Date.now());
  const back = () => {
    router.push('/');
  };
  // No 30-day window yet (no refill time): nothing to show, so a direct visit goes back to the
  // chat instead of a blank screen (browser QA 2).
  useBackToChat(budget !== undefined && budget.chainResetAtSec === null);
  if (!budget || budget.chainResetAtSec === null) {
    return <TopBar onBack={back} backLabel="대화로 돌아가기" />;
  }
  return (
    <>
      <TopBar onBack={back} backLabel="대화로 돌아가기" />
      <CapReached
        resetAt={budget.chainResetAtSec}
        cap={parseAokrw(budget.chainCap)}
        now={now}
        // "다시 채워지면 알려 줘": a reminder has no server yet (web.md "아직").
        onNotify={back}
        onDismiss={back}
      />
    </>
  );
}
