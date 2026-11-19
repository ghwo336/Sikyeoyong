'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { orderKey } from './useOrder';

/**
 * POST /orders/:id/confirm, the only call that pays (CLAUDE.md rule 3). Called from the
 * confirm sheet button only. Never retried on its own (rule 9): a retry is the user pressing
 * again on the same order. Callbacks live on the mutation so they still run after the screen
 * has moved on to the order status page (optimistic UI).
 */
export function useConfirmOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => api.confirmOrder(orderId),
    onSuccess: ({ order }) => {
      qc.setQueryData(orderKey(order.id), order);
    },
    onError: (_err, orderId) => {
      // TODO: go back to the chat and let the dragon say why (web.md "조립 현황").
      void qc.invalidateQueries({ queryKey: orderKey(orderId) });
    },
  });
}
