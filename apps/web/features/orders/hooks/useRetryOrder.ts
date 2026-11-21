'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { orderKey } from './useOrder';
import { ORDERS_KEY } from './useOrders';

/**
 * "다시 시도하기" on a failed order (D-19): POST /orders/:id/confirm again on the same order, so
 * the same orderRef is used and the server checks the chain first. Only the person's press calls
 * it, never a timer (CLAUDE.md rule 9). The screen stays on the order and shows the new state.
 */
export function useRetryOrder(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.confirmOrder(orderId),
    onSuccess: ({ order }) => {
      qc.setQueryData(orderKey(orderId), order);
      void qc.invalidateQueries({ queryKey: ORDERS_KEY });
    },
  });
}
