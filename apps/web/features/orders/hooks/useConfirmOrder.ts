'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import { orderKey } from './useOrder';
import { ORDERS_KEY } from './useOrders';

/**
 * POST /orders/:id/confirm, the only call that pays (CLAUDE.md rule 3). Called from the
 * confirm sheet button only. Never retried on its own (rule 9): a retry is the user pressing
 * again on the same order. Callbacks live on the mutation so they still run after the screen
 * has moved on to the order status page (optimistic UI).
 */
export function useConfirmOrder() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (orderId: string) => api.confirmOrder(orderId),
    onSuccess: ({ order }) => {
      qc.setQueryData(orderKey(order.id), order);
      // The Main card and the history show it from now on.
      void qc.invalidateQueries({ queryKey: ORDERS_KEY });
    },
    onError: (_err, orderId) => {
      // Undo the optimistic move: back to the chat. The dragon saying why needs the
      // order_failed ChatEvent in shared first (web.md "조립 현황").
      void qc.invalidateQueries({ queryKey: orderKey(orderId) });
      router.replace('/');
    },
  });
}
