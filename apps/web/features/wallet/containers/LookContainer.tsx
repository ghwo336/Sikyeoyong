'use client';

import type { DragonSpecies } from '@sikyeoyong/shared';
import { Button, ErrorLine, LookPreview, SpeciesPicker, TopBar } from '@sikyeoyong/ui';
import { useTransitionRouter } from '../../../lib/transition-router';
import { useEffect, useRef, useState } from 'react';
import { applySpecies } from '../../../lib/theme';
import { useMe } from '../../me/hooks/useMe';
import { useChangeLook } from '../hooks/useChangeLook';

/**
 * Look.dc.html (D-32): pick a species and see the dragon, its line and the app color at once
 * (a preview, nothing saved); "이 모습으로 바꾸기" saves it (PATCH /agents/:id) and goes back to
 * the Wallet. Leaving any other way puts the saved look back.
 */
export function LookContainer() {
  const router = useTransitionRouter();
  const me = useMe().data;
  const change = useChangeLook();
  const [picked, setPicked] = useState<DragonSpecies | null>(null);
  // The look to go back to when the screen closes: the saved one, or the new one once saved.
  const saved = useRef<DragonSpecies | undefined>(undefined);

  useEffect(() => {
    saved.current ??= me?.dragonSpecies;
  }, [me?.dragonSpecies]);
  useEffect(() => {
    if (picked !== null) applySpecies(picked, { remember: false });
  }, [picked]);
  useEffect(
    () => () => {
      if (saved.current !== undefined) applySpecies(saved.current);
    },
    [],
  );

  if (!me) return null;
  const species = picked ?? me.dragonSpecies;
  const back = () => {
    router.replace('/dragon');
  };
  return (
    <>
      <TopBar title="용이 모습" onBack={back} />
      <LookPreview name={me.dragonName} species={species} />
      <SpeciesPicker value={species} onChange={setPicked} />
      {change.isError ? <ErrorLine>모습을 못 바꿨어요. 다시 눌러 주세요.</ErrorLine> : null}
      <Button
        variant="primary"
        loading={change.isPending}
        onPress={() => {
          // user-flow 18: the same look just goes back, no request.
          if (species === me.dragonSpecies) {
            back();
            return;
          }
          change.mutate(
            { agentId: me.agentId, species },
            {
              onSuccess: ({ dragonSpecies }) => {
                saved.current = dragonSpecies;
                applySpecies(dragonSpecies);
                back();
              },
            },
          );
        }}
      >
        이 모습으로 바꾸기
      </Button>
    </>
  );
}
