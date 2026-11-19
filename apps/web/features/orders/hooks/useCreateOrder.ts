'use client';

import { useMutation } from '@tanstack/react-query';
import { api, type RecommendationCard } from '../../../lib/api';

/**
 * Asks the server for a quote on a picked recommendation (POST /orders, the app-button twin of
 * place_order). It never pays: the result is a confirm card or a wait for the owner's approval.
 */
export function useCreateOrder() {
  return useMutation({
    mutationFn: (rec: RecommendationCard) =>
      api.createOrder({
        merchantId: rec.merchantId,
        items: [{ menuId: rec.menuId, qty: 1 }],
        clientOrderId: crypto.randomUUID(),
      }),
  });
}
