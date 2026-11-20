'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { shouldPoll } from '../status';

export const orderKey = (orderId: string) => ['order', orderId] as const;

/** One order and its status (GET /orders/:id). */
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: orderKey(orderId),
    queryFn: async () => (await api.getOrder(orderId)).order,
    // Until it arrives (or stops) the screens follow it: cooking, on the road, arrived.
    refetchInterval: (q) => (shouldPoll(q.state.data?.status) ? 2_000 : false),
  });
}

/** Arrived.dc.html taste rating. */
export function useRateOrder(orderId: string) {
  return useMutation({
    mutationFn: (value: 'again' | 'okay' | 'meh') => api.rateOrder(orderId, value),
  });
}
