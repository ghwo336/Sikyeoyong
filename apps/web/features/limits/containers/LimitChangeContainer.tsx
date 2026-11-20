'use client';

import { formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import { DragonLine, LimitChangeCard } from '@sikyeoyong/ui';
import type { DragonSpecies } from '@sikyeoyong/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LimitChangeCardView } from '../../../lib/api';
import { useRaiseLevel } from '../hooks/useRaiseLevel';

/**
 * LimitChat.dc.html: the change card the dragon put in the chat (D-21). Nothing changes until
 * the owner presses it (the re-auth step, Q-36); then the dragon says the new limit.
 */
export function LimitChangeContainer({
  card,
  species,
}: {
  readonly card: LimitChangeCardView;
  readonly species: DragonSpecies;
}) {
  const router = useRouter();
  const raise = useRaiseLevel();
  const [state, setState] = useState<'open' | 'done' | 'dropped'>('open');
  if (state === 'dropped') return null;
  if (state === 'done') {
    return (
      <DragonLine
        text={`레벨 ${String(card.levelTo ?? '')}이 됐어용! 이제 한 번에 ${formatOkrw(parseAokrw(card.to))}까지 시킬 수 있어용.`}
        mood="happy"
        layout="chat"
        species={species}
      />
    );
  }
  return (
    <LimitChangeCard
      field={card.field}
      from={parseAokrw(card.from)}
      to={parseAokrw(card.to)}
      {...(card.levelFrom === undefined ? {} : { levelFrom: card.levelFrom })}
      {...(card.levelTo === undefined ? {} : { levelTo: card.levelTo })}
      needsReauth={card.needsReauth}
      rows={card.rows}
      status={raise.isPending ? 'confirming' : raise.isError ? 'failed' : 'idle'}
      onConfirm={() => {
        if (raise.isPending || card.field !== 'perOrder' || card.levelTo === undefined) return;
        raise.mutate(card.levelTo, {
          onSuccess: () => {
            setState('done');
            router.refresh();
          },
        });
      }}
      onCancel={() => {
        setState('dropped');
      }}
    />
  );
}
