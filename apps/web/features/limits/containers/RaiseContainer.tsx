'use client';

import { formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import { LimitChangeCard, TopBar } from '@sikyeoyong/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useBudget } from '../../budget/hooks/useBudget';
import { handQuoteToChat } from '../../chat/hooks/useChat';
import { useOrder } from '../../orders/hooks/useOrder';
import { useRequoteOrder } from '../../orders/hooks/useRequoteOrder';
import { limitToFit } from '../fit';
import { useBackToChat } from '../hooks/useBackToChat';
import { useSetLimits } from '../hooks/useSetLimits';

/**
 * Blocked's "한 번에 N원으로 올리고 시키기" (D-31): the change card (LimitChat.dc.html card). The
 * button is the re-auth step (D-28: the button alone on testnet, a wallet signature with pouch).
 * After the raise the waiting order is quoted again and the chat opens with its confirm sheet
 * (user-flow 12 "O -> I"); paying is still that sheet's button (CLAUDE.md rule 3).
 */
export function RaiseContainer({ orderId }: { readonly orderId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const budget = useBudget().data;
  const orderQuery = useOrder(orderId);
  const order = orderQuery.data;
  const raise = useSetLimits();
  const requote = useRequoteOrder();
  const back = () => {
    router.push(`/limit/${encodeURIComponent(orderId)}`);
  };
  const toChat = () => {
    router.push('/');
  };
  // The limit when the button was pressed: after the raise the budget already holds the new one,
  // and the card stays (confirming) with its old amount until the chat opens.
  const [pressedFrom, setPressedFrom] = useState<bigint | undefined>(undefined);
  const to = order ? limitToFit(parseAokrw(order.amount)) : undefined;
  // Nothing to raise: no limit in the range covers it, or the limit is already there.
  const nothingToRaise =
    budget !== undefined &&
    order !== undefined &&
    pressedFrom === undefined &&
    (to === undefined || to <= parseAokrw(budget.perOrderLimit));
  useBackToChat(orderQuery.isError || nothingToRaise);
  if (
    !budget ||
    !order ||
    to === undefined ||
    (pressedFrom === undefined && to <= parseAokrw(budget.perOrderLimit))
  ) {
    return <TopBar title="한도 바꾸기" onBack={back} />;
  }
  const from = pressedFrom ?? parseAokrw(budget.perOrderLimit);
  return (
    <>
      <TopBar title="한도 바꾸기" onBack={back} />
      <LimitChangeCard
        field="perOrder"
        from={from}
        to={to}
        needsReauth
        rows={[
          {
            label: '30일에 쓸 돈',
            value: `${formatOkrw(parseAokrw(budget.myPeriodicLimit))} 그대로`,
          },
        ]}
        status={
          raise.isError ? 'failed' : raise.isPending || raise.isSuccess ? 'confirming' : 'idle'
        }
        onConfirm={() => {
          if (raise.isPending || raise.isSuccess) return;
          setPressedFrom(from);
          raise.mutate(
            { perOrderLimit: to.toString() },
            {
              onSuccess: () => {
                requote.mutate(orderId, {
                  onSuccess: (res) => {
                    if (res.quote) handQuoteToChat(qc, res.quote);
                    toChat();
                  },
                  // The limit is raised either way; the order can be picked again in the chat.
                  onError: toChat,
                });
              },
            },
          );
        }}
        onCancel={toChat}
      />
    </>
  );
}
