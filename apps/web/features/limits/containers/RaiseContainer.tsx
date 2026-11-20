'use client';

import { formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import { LimitChangeCard, TopBar } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useBudget } from '../../budget/hooks/useBudget';
import { useOrder } from '../../orders/hooks/useOrder';
import { limitToFit } from '../fit';
import { useSetLimits } from '../hooks/useSetLimits';

/**
 * Blocked's "한 번에 N원으로 올리고 시키기" (D-31): the change card (LimitChat.dc.html card). The button is
 * the re-auth step (D-28: the button alone on testnet, a wallet signature with pouch); then back to the chat to pick it again.
 */
export function RaiseContainer({ orderId }: { readonly orderId: string }) {
  const router = useRouter();
  const budget = useBudget().data;
  const { data: order } = useOrder(orderId);
  const raise = useSetLimits();
  const back = () => {
    router.push(`/limit/${encodeURIComponent(orderId)}`);
  };
  const to = order ? limitToFit(parseAokrw(order.amount)) : undefined;
  // Nothing to raise: no limit in the range covers it, or the limit is already there.
  if (!budget || !order || to === undefined || to <= parseAokrw(budget.perOrderLimit)) {
    return <TopBar title="한도 바꾸기" onBack={back} />;
  }
  return (
    <>
      <TopBar title="한도 바꾸기" onBack={back} />
      <LimitChangeCard
        field="perOrder"
        from={parseAokrw(budget.perOrderLimit)}
        to={to}
        needsReauth
        rows={[
          {
            label: '30일에 쓸 돈',
            value: `${formatOkrw(parseAokrw(budget.myPeriodicLimit))} 그대로`,
          },
        ]}
        status={raise.isPending ? 'confirming' : raise.isError ? 'failed' : 'idle'}
        onConfirm={() => {
          if (raise.isPending) return;
          raise.mutate(
            { perOrderLimit: to.toString() },
            {
              onSuccess: () => {
                router.push('/');
              },
            },
          );
        }}
        onCancel={() => {
          router.push('/');
        }}
      />
    </>
  );
}
