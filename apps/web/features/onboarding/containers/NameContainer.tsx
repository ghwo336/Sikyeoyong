'use client';

import type { DragonSpecies } from '@sikyeoyong/shared';
import { Button, EggPicker, StepProgress, TextField } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SIGNUP_STEPS } from '../steps';
import { useCreateAgent } from '../hooks/useSignup';

/** Name.dc.html: pick an egg, name it, wake it. */
export function NameContainer() {
  const router = useRouter();
  const create = useCreateAgent();
  const [species, setSpecies] = useState<DragonSpecies>('forest');
  const [name, setName] = useState('용이');
  const [tried, setTried] = useState(false);
  const empty = name.trim() === '';
  return (
    <>
      <StepProgress steps={SIGNUP_STEPS} current={2} />
      <EggPicker value={species} onChange={setSpecies} />
      <TextField
        label="이름"
        value={name}
        onChange={setName}
        maxLength={8}
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
