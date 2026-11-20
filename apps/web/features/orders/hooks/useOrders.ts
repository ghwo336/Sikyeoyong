'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { activeOrder } from '../active';

export const ORDERS_KEY = ['orders'] as const;

/** How often the list is asked again while an order is on its way (the Main card moves). */
export const ORDERS_POLL_MS = 5_000;

/**
 * The owner's recent orders, newest first (GET /orders): the Main card and the history.
 * While one is on its way the list is asked again, so the card follows it.
 */
export function useOrders() {
  return useQuery({
    queryKey: ORDERS_KEY,
    queryFn: () => api.listOrders(),
    refetchInterval: (q) => (activeOrder(q.state.data?.orders ?? []) ? ORDERS_POLL_MS : false),
  });
}
