'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { DragonLine, OrderStatusHeader, OrderSummary, StepProgress, TopBar } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import type { OrderStatus } from '../../../lib/api';
import { routeLine } from '../../../lib/format';
import { useMe } from '../../me/hooks/useMe';
import { useOrder } from '../hooks/useOrder';

const STEPS = ['주문 접수', '조리 중', '배달 중', '도착'] as const;

/** Which of the four steps the order is on (Done.dc.html). */
const STEP_OF: { readonly [S in OrderStatus]: number } = {
  quoted: 1,
  pending_approval: 1,
  submitting: 1,
  paid: 1,
  preparing: 2,
  delivering: 3,
  delivered: 4,
  failed: 1,
  cancelled: 1,
  refunded: 1,
};

/** Order status while cooking (Done.dc.html). Tracking and Arrived come later (web.md). */
export function OrderStatusContainer({ orderId }: { readonly orderId: string }) {
  const router = useRouter();
  const me = useMe().data;
  const { data: order } = useOrder(orderId);
  const back = () => {
    router.push('/');
  };
  if (!order || !me) return <TopBar title="주문 현황" backLabel="대화로 돌아가기" onBack={back} />;
  return (
    <>
      <TopBar title="주문 현황" backLabel="대화로 돌아가기" onBack={back} />
      <OrderStatusHeader
        etaAt={order.etaAt}
        remainingMin={order.remainingMin}
        variant="eta-first"
      />
      <StepProgress steps={STEPS} current={STEP_OF[order.status]} showLabels size="md" />
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
