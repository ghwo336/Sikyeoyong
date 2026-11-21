import { parseAokrw } from '@sikyeoyong/shared';
import type { OrderView } from '../../lib/api';
import { ORDER_STEPS, orderStep } from './status';

/** "돼지국밥", or "돼지국밥 외 1개" for more than one line. */
export function menuLabel(items: OrderView['items']): string {
  const first = items[0]?.name ?? '';
  return items.length > 1 ? `${first} 외 ${String(items.length - 1)}개` : first;
}

/**
 * The order the Main card shows (Main.dc.html): the newest one still on its way (accepted,
 * cooking or on the road). Arrived, not paid and stopped orders have no card. The list comes
 * newest first (GET /orders).
 */
export function activeOrder(orders: readonly OrderView[]): OrderView | undefined {
  return orders.find((o) => {
    const step = orderStep(o.status);
    return step !== null && step < ORDER_STEPS.length;
  });
}

/** The card's words for an order on its way, as Main.dc.html says them. */
export function activeCard(order: OrderView): {
  readonly menu: string;
  readonly status: string;
  readonly eta: string;
  readonly current: number;
} {
  const current = orderStep(order.status) ?? 1;
  const eta =
    current === 1
      ? '가게가 확인 중'
      : current === 2
        ? '곧 출발해요'
        : order.remainingMin > 0
          ? `${String(order.remainingMin)}분 남았어요`
          : '곧 도착해요';
  return { menu: menuLabel(order.items), status: ORDER_STEPS[current - 1] ?? '', eta, current };
}

/**
 * Where an order in the history opens, or undefined when it has no screen to open: its status
 * screen while on its way, its receipt once it arrived, the limit screen while it waits only
 * because it is over the per-order limit (perOrderLimit, aokrw), a failed order's status
 * screen (the dragon's reason, retry). A cancelled or refunded order and one waiting for another reason (a new store, the 30-day limit) have
 * no screen yet, so the row is not pressable (browser QA: they opened blank screens).
 */
export function orderHref(order: OrderView, perOrderLimit: bigint | undefined): string | undefined {
  const step = orderStep(order.status);
  const id = encodeURIComponent(order.id);
  if (order.status === 'pending_approval') {
    return perOrderLimit !== undefined && parseAokrw(order.amount) > perOrderLimit
      ? `/limit/${id}`
      : undefined;
  }
  if (order.status === 'delivered') return `/orders/${id}/receipt`;
  // A failed order opens its status screen: why it stopped and the next step.
  if (order.status === 'failed') return `/orders/${id}`;
  return step !== null && step < ORDER_STEPS.length ? `/orders/${id}` : undefined;
}

/** The history row's name: the menu, and where it is while on its way or why it stopped. */
export function historyLabel(order: OrderView): string {
  const menu = menuLabel(order.items);
  const step = orderStep(order.status);
  if (step !== null && step < ORDER_STEPS.length) return `${menu}, ${ORDER_STEPS[step - 1] ?? ''}`;
  if (order.status === 'pending_approval') return `${menu}, 허락 기다리는 중`;
  // failed: payment refused or the owner said no or did not answer (D-19); nothing was spent.
  if (order.status === 'failed') return `${menu}, 멈춤`;
  if (order.status === 'cancelled') return `${menu}, 취소`;
  if (order.status === 'refunded') return `${menu}, 환불`;
  return menu;
}
