'use client';

import { useMutation } from '@tanstack/react-query';
import { api } from '../../../lib/api';

/**
 * After the owner raised the per-order limit from Blocked: the order that waited for it, quoted
 * again (POST /orders/:id/requote). It never pays; the confirm sheet's button still does.
 */
export function useRequoteOrder() {
  return useMutation({ mutationFn: (orderId: string) => api.requoteOrder(orderId) });
}
