'use client';

import { Egg, HatchProgress, Hero, ScreenTitle } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useMe } from '../../me/hooks/useMe';
import { markBudgetStepPending } from '../pending-budget';
import { HATCH_LABEL } from '../steps';
import { useAgentSetup, useRetryAgentSetup } from '../hooks/useSignup';

/** Hatch.dc.html: the wobbling egg and the three setup steps; moves on when the dragon is up. */
export function HatchContainer() {
  const router = useRouter();
  const me = useMe().data;
  const setup = useAgentSetup().data;
  const retry = useRetryAgentSetup();
  // Only an owner who watched it hatch (PENDING, then ACTIVE) gets the sign-up budget step;
  // one who opens /hatch already set up goes on without it.
  const watched = useRef(false);
  const status = setup?.status;
  useEffect(() => {
    if (status === 'PENDING') watched.current = true;
    if (status !== 'ACTIVE') return;
    if (watched.current) markBudgetStepPending();
    router.replace(watched.current ? '/budget' : '/');
  }, [status, router]);
  if (!me || !setup) return null;
  return (
    <>
      <Hero gap="md" art={<Egg state="wobble" species={me.dragonSpecies} size={176} />}>
        <ScreenTitle
          variant="dragon"
          title="알이 흔들려용..."
          description="1~3분 걸려요. 다 되면 알려 드릴게요."
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
