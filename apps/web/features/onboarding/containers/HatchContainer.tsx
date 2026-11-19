'use client';

import { DragonLine, Egg, HatchProgress } from '@sikyeoyong/ui';
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
      <Egg state="wobble" species={me.dragonSpecies} size={176} />
      <DragonLine
        text="알이 흔들려용..."
        layout="center"
        species={me.dragonSpecies}
        avatar={false}
      />
      <HatchProgress
        steps={setup.steps.map((s) => ({ label: HATCH_LABEL[s.key], status: s.status }))}
        onRetry={() => {
          retry.mutate();
        }}
      />
    </>
  );
}
