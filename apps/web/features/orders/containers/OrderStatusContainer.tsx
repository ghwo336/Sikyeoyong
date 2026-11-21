'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import {
  DeliveryMap,
  DragonLine,
  LoadingShape,
  OrderStatusHeader,
  OrderSummary,
  RetryLine,
  StepProgress,
  TopBar,
} from '@sikyeoyong/ui';
import { useTransitionRouter } from '../../../lib/transition-router';
import { routeLine } from '../../../lib/format';
import { useMe } from '../../me/hooks/useMe';
import { useOrder } from '../hooks/useOrder';
import { DEMO_ROAD, riderProgress } from '../map';
import { ORDER_STEPS, orderStep } from '../status';
import { ArrivedContainer } from './ArrivedContainer';

/** Order status: cooking (Done.dc.html), on the road (Tracking.dc.html), arrived (Arrived.dc.html). */
export function OrderStatusContainer({ orderId }: { readonly orderId: string }) {
  const router = useTransitionRouter();
  const meQuery = useMe();
  const me = meQuery.data;
  const orderQuery = useOrder(orderId);
  const { data: order, isError } = orderQuery;
  const back = () => {
    router.push('/');
  };
  const step = order ? orderStep(order.status) : null;
  // Loading, unknown, unpaid or stopped orders show no progress: a failed or refunded order
  // must never look accepted. Their own screens are not built yet (web.md).
  // A failed query ends in an error line with a retry, never a blank screen or a shape that
  // waits forever (QA 4).
  if ((!order && isError) || (!me && meQuery.isError)) {
    return (
      <>
        <TopBar title="주문 현황" backLabel="대화로 돌아가기" onBack={back} />
        <RetryLine
          onRetry={() => {
            if (!order && isError) void orderQuery.refetch();
            if (!me && meQuery.isError) void meQuery.refetch();
          }}
        >
          주문 현황을 못 불러왔어요
        </RetryLine>
      </>
    );
  }
  if (!order || !me) {
    // Still loading: the shape of the status screen, so it does not jump when the order arrives.
    return (
      <>
        <TopBar title="주문 현황" backLabel="대화로 돌아가기" onBack={back} />
        <LoadingShape kind="orderStatus" />
      </>
    );
  }
  if (step === null) {
    return <TopBar title="주문 현황" backLabel="대화로 돌아가기" onBack={back} />;
  }
  if (order.status === 'delivered') return <ArrivedContainer order={order} />;
  const riding = order.status === 'delivering';
  return (
    <>
      <TopBar title="주문 현황" backLabel="대화로 돌아가기" onBack={back} />
      <OrderStatusHeader
        etaAt={order.etaAt}
        remainingMin={order.remainingMin}
        variant={riding ? 'remaining-first' : 'eta-first'}
      />
      {riding && (
        <DeliveryMap
          store={DEMO_ROAD.store}
          home={DEMO_ROAD.home}
          route={DEMO_ROAD.route}
          progress={riderProgress(order.remainingMin)}
          storeName={order.store}
          homeName={order.destination}
        />
      )}
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
