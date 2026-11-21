'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type RecommendationCard } from '../../../lib/api';
import { APPROVALS_KEY } from '../../approvals/hooks/useApprovals';
import { ORDERS_KEY } from './useOrders';

/**
 * Asks the server for a quote on a picked recommendation (POST /orders, the app-button twin of
 * place_order). It never pays: the result is a confirm card or a wait for the owner's approval.
 */
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rec: RecommendationCard) =>
      api.createOrder({
        merchantId: rec.merchantId,
        items: [{ menuId: rec.menuId, qty: 1 }],
        clientOrderId: crypto.randomUUID(),
      }),
    // An order that waits for the owner brings its approval card (and a history row).
    onSuccess: async (res) => {
      if (res.order.status !== 'pending_approval') return;
      await Promise.all([
        qc.invalidateQueries({ queryKey: APPROVALS_KEY }),
        qc.invalidateQueries({ queryKey: ORDERS_KEY }),
      ]);
    },
  });
}
