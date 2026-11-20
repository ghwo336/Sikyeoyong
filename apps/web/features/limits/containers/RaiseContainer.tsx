'use client';

import { formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import { LimitChangeCard, TopBar } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useBudget } from '../../budget/hooks/useBudget';
import { useOrder } from '../../orders/hooks/useOrder';
import { useRaiseLevel } from '../hooks/useRaiseLevel';
import { levelFor } from '../levels';

/**
 * Blocked's "레벨 N으로 올리고 시키기": the change card (LimitChat.dc.html card). The button is
 * the re-auth step (D-28: the button alone on testnet, a wallet signature with pouch); then back to the chat to pick it again.
 */
export function RaiseContainer({ orderId }: { readonly orderId: string }) {
  const router = useRouter();
  const budget = useBudget().data;
  const { data: order } = useOrder(orderId);
  const raise = useRaiseLevel();
  const back = () => {
    router.push(`/limit/${encodeURIComponent(orderId)}`);
  };
  const next = order ? levelFor(parseAokrw(order.amount)) : undefined;
  // Nothing to raise: no level covers it, or the dragon is already there.
  if (!budget || !order || next === undefined || next.level <= budget.level) {
    return <TopBar title="한도 바꾸기" onBack={back} />;
  }
  return (
    <>
      <TopBar title="한도 바꾸기" onBack={back} />
      <LimitChangeCard
        field="perOrder"
        from={parseAokrw(budget.perOrderLimit)}
        to={next.limit}
        levelFrom={budget.level}
        levelTo={next.level}
        needsReauth
        rows={[{ label: '30일 한도', value: `${formatOkrw(parseAokrw(budget.chainCap))} 그대로` }]}
        status={raise.isPending ? 'confirming' : raise.isError ? 'failed' : 'idle'}
        onConfirm={() => {
          if (raise.isPending) return;
          raise.mutate(next.level, {
            onSuccess: () => {
              router.push('/');
            },
          });
        }}
        onCancel={() => {
          router.push('/');
        }}
      />
    </>
  );
}
