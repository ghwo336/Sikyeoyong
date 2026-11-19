import type { OrderStatus } from '../../lib/api';

export const ORDER_STEPS = ['주문 접수', '조리 중', '배달 중', '도착'] as const;

/**
 * Which of the four steps (Done.dc.html) an order is on, or null when it is not on its way:
 * not paid yet (quoted, pending_approval) or stopped (failed, cancelled, refunded). A stopped
 * order must never look like an accepted one.
 */
export function orderStep(status: OrderStatus): number | null {
  switch (status) {
    case 'submitting':
    case 'paid':
      return 1;
    case 'preparing':
      return 2;
    case 'delivering':
      return 3;
    case 'delivered':
      return 4;
    case 'quoted':
    case 'pending_approval':
    case 'failed':
    case 'cancelled':
    case 'refunded':
      return null;
  }
}
