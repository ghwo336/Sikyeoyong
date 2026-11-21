'use client';

import type { DragonSpecies } from '@sikyeoyong/shared';
import { Button, EggPicker, ScreenTitle, StepProgress, TextField, TopBar } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { applySpecies } from '../../../lib/theme';
import { markBudgetStepPending } from '../pending-budget';
import { BORN_LINE, SIGNUP_STEPS } from '../steps';
import { useCreateAgent } from '../hooks/useSignup';

/** Name.dc.html: pick an egg, name it, wake it. */
export function NameContainer() {
  const router = useRouter();
  const create = useCreateAgent();
  const [species, setSpecies] = useState<DragonSpecies>('forest');
  const [name, setName] = useState('용이');
  const [tried, setTried] = useState(false);
  const empty = name.trim() === '';
  // D-32: the screen takes the picked egg's colors at once, before anything is saved.
  useEffect(() => {
    applySpecies(species, { remember: false });
  }, [species]);
  return (
    <>
      <TopBar
        onBack={() => {
          // The step before, not history: a reload or a direct link has none (web.md).
          router.replace('/verify');
        }}
        trailing={<StepProgress steps={SIGNUP_STEPS} current={2} />}
      />
      <ScreenTitle variant="title" title={'알을 하나 골라\n이름을 지어 주세요'} />
      <EggPicker value={species} onChange={setSpecies} />
      <TextField
        label="이름"
        value={name}
        onChange={setName}
        maxLength={8}
        hint={BORN_LINE}
        // user-flow 3: an empty name explains instead of disabling the button.
        error={tried && empty ? '이름을 지어 주세요' : undefined}
      />
      <Button
        variant="primary"
        loading={create.isPending}
        onPress={() => {
          setTried(true);
          if (empty) return;
          create.mutate(
            { dragonName: name.trim(), dragonSpecies: species },
            {
              onSuccess: () => {
                // This owner is signing up now: the limits step follows the hatch even when the
                // dragon is up before Hatch ever sees PENDING (QA 6 L1).
                markBudgetStepPending();
                applySpecies(species);
                router.push('/hatch');
              },
            },
          );
        }}
      >
        알 깨우기
      </Button>
    </>
  );
}
