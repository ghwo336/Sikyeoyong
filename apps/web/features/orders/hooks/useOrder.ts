'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';

export const orderKey = (orderId: string) => ['order', orderId] as const;

/** One order and its status (GET /orders/:id). */
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: orderKey(orderId),
    queryFn: async () => (await api.getOrder(orderId)).order,
  });
}
