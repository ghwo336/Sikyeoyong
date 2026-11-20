'use client';

import { formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import { DragonLine, LimitChangeCard } from '@sikyeoyong/ui';
import type { DragonSpecies } from '@sikyeoyong/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LimitChangeCardView } from '../../../lib/api';
import { useBudget } from '../../budget/hooks/useBudget';
import { useSetLimits } from '../hooks/useSetLimits';

/**
 * LimitChat.dc.html: the change card the dragon put in the chat (D-21). Nothing changes until
 * the owner presses it (the re-auth step, D-28); then the dragon says the new limit.
 */
export function LimitChangeContainer({
  card,
  species,
}: {
  readonly card: LimitChangeCardView;
  readonly species: DragonSpecies;
}) {
  const router = useRouter();
  const raise = useSetLimits();
  const budget = useBudget().data;
  const [state, setState] = useState<'open' | 'done' | 'dropped'>('open');
  // A card from the history is pressable only while the limit is still its "before": once the
  // limit is its "after" it was applied (the done line), and any other value makes it outdated
  // (nothing to press, browser QA).
  const now =
    budget === undefined
      ? undefined
      : parseAokrw(card.field === 'perOrder' ? budget.perOrderLimit : budget.myPeriodicLimit);
  const from = parseAokrw(card.from);
  const to = parseAokrw(card.to);
  const applied = state === 'done' || (state === 'open' && now === to && !raise.isPending);
  const outdated = state === 'open' && now !== undefined && now !== from && now !== to;
  if (state === 'dropped' || outdated) return null;
  if (applied) {
    return (
      <DragonLine
        text={
          card.field === 'perOrder'
            ? `바꿨어용! 이제 한 번에 ${formatOkrw(parseAokrw(card.to))}까지 시킬 수 있어용.`
            : `바꿨어용! 이제 30일에 ${formatOkrw(parseAokrw(card.to))}까지 시킬게용.`
        }
        mood="happy"
        layout="chat"
        species={species}
      />
    );
  }
  return (
    <LimitChangeCard
      field={card.field}
      from={from}
      to={to}
      needsReauth={card.needsReauth}
      rows={card.rows}
      status={raise.isPending ? 'confirming' : raise.isError ? 'failed' : 'idle'}
      onConfirm={() => {
        if (raise.isPending) return;
        const body =
          card.field === 'perOrder' ? { perOrderLimit: card.to } : { myPeriodicLimit: card.to };
        raise.mutate(body, {
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
