'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { DragonLine, OrderStatusHeader, OrderSummary, StepProgress, TopBar } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { routeLine } from '../../../lib/format';
import { useMe } from '../../me/hooks/useMe';
import { useOrder } from '../hooks/useOrder';
import { ORDER_STEPS, orderStep } from '../status';

/** Order status while cooking (Done.dc.html). Tracking and Arrived come later (web.md). */
export function OrderStatusContainer({ orderId }: { readonly orderId: string }) {
  const router = useRouter();
  const me = useMe().data;
  const { data: order } = useOrder(orderId);
  const back = () => {
    router.push('/');
  };
  const step = order ? orderStep(order.status) : null;
  // Loading, unknown, unpaid or stopped orders show no progress: a failed or refunded order
  // must never look accepted. Their own screens are not built yet (web.md).
  if (!order || !me || step === null) {
    return <TopBar title="주문 현황" backLabel="대화로 돌아가기" onBack={back} />;
  }
  return (
    <>
      <TopBar title="주문 현황" backLabel="대화로 돌아가기" onBack={back} />
      <OrderStatusHeader
        etaAt={order.etaAt}
        remainingMin={order.remainingMin}
        variant="eta-first"
      />
      <StepProgress steps={ORDER_STEPS} current={step} showLabels size="md" />
      <DragonLine
        text={order.dragonLine}
        mood={order.dragonMood}
        layout="inline"
        species={me.dragonSpecies}
      />
      <OrderSummary
        store={routeLine(order.store, order.destination)}
        items={order.items.map((l) => ({
          name: l.name,
          quantity: l.quantity,
          price: parseAokrw(l.price),
        }))}
        request={order.request}
        total={parseAokrw(order.amount)}
      />
    </>
  );
}
