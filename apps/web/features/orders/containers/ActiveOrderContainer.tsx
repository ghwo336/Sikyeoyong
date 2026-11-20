'use client';

import { ActiveOrderCard } from '@sikyeoyong/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { activeCard, activeOrder } from '../active';
import { orderKey } from '../hooks/useOrder';
import { useOrders } from '../hooks/useOrders';
import { ORDER_STEPS } from '../status';

/**
 * Main.dc.html: the order on its way, under the budget card. A press opens its status screen
 * (accepted and cooking: Done, on the road: Tracking; /orders/:id picks by status), with the
 * order already in the cache so it shows at once (D-23).
 */
export function ActiveOrderContainer() {
  const router = useRouter();
  const qc = useQueryClient();
  const orders = useOrders().data?.orders;
  const order = orders ? activeOrder(orders) : undefined;
  if (!order) return null;
  return (
    <ActiveOrderCard
      {...activeCard(order)}
      steps={ORDER_STEPS}
      onPress={() => {
        qc.setQueryData(orderKey(order.id), order);
        router.push(`/orders/${encodeURIComponent(order.id)}`);
      }}
    />
  );
}
