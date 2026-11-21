'use client';

import { Egg, HatchProgress, Hero, RetryLine, ScreenTitle } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useMe } from '../../me/hooks/useMe';
import { isBudgetStepPending, markBudgetStepPending } from '../pending-budget';
import { HATCH_LABEL } from '../steps';
import { useAgentSetup, useRetryAgentSetup } from '../hooks/useSignup';

/** Hatch.dc.html: the wobbling egg and the three setup steps; moves on when the dragon is up. */
export function HatchContainer() {
  const router = useRouter();
  const me = useMe().data;
  const setupQuery = useAgentSetup();
  const setup = setupQuery.data;
  const retry = useRetryAgentSetup();
  // Only an owner signing up gets the budget step (watched PENDING then ACTIVE, or Name's mark);
  // one who opens /hatch already set up goes on without it.
  const watched = useRef(false);
  const status = setup?.status;
  useEffect(() => {
    if (status === 'PENDING') watched.current = true;
    if (status !== 'ACTIVE') return;
    // Watched hatching, or created in this sign-up (Name left the mark): the limits step is next.
    const signup = watched.current || isBudgetStepPending();
    if (signup) markBudgetStepPending();
    router.replace(signup ? '/budget' : '/');
  }, [status, router]);
  if (me && !setup && setupQuery.isError) {
    return (
      <RetryLine
        onRetry={() => {
          void setupQuery.refetch();
        }}
      >
        부화 소식을 못 불러왔어요
      </RetryLine>
    );
  }
  if (!me || !setup) return null;
  // Hatch.dc.html draws the wobbling words while steps run; once all three are done the title
  // says so instead of still wobbling (the design has no separate frame, 2026-11-22 QA).
  const allDone = setup.steps.every((s) => s.status === 'done');
  return (
    <>
      <Hero gap="md" art={<Egg state="wobble" species={me.dragonSpecies} size={176} />}>
        <ScreenTitle
          variant="dragon"
          title={allDone ? '다 됐어용!' : '알이 흔들려용...'}
          description={allDone ? '곧 용이가 나와요.' : '1~3분 걸려요. 다 되면 알려 드릴게요.'}
        />
      </Hero>
      <HatchProgress
        steps={setup.steps.map((s) => ({ label: HATCH_LABEL[s.key], status: s.status }))}
        onRetry={() => {
          retry.mutate();
        }}
      />
    </>
  );
}
