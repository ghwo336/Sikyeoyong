'use client';

import { Egg, HatchProgress, Hero, ScreenTitle } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useMe } from '../../me/hooks/useMe';
import { HATCH_LABEL } from '../steps';
import { useAgentSetup, useRetryAgentSetup } from '../hooks/useSignup';

/** Hatch.dc.html: the wobbling egg and the three setup steps; moves on when the dragon is up. */
export function HatchContainer() {
  const router = useRouter();
  const me = useMe().data;
  const setup = useAgentSetup().data;
  const retry = useRetryAgentSetup();
  const active = setup?.status === 'ACTIVE';
  useEffect(() => {
    if (active) router.replace('/budget');
  }, [active, router]);
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
