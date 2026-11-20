'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { retryMe } from '../entry';

/** The signed-in owner and their dragon (GET /me). */
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api.getMe(), retry: retryMe });
}

/** GET /identity, only for a signed-in owner without a dragon (the front door's Verify or Name). */
export function useIdentity(enabled: boolean) {
  return useQuery({ queryKey: ['identity'], queryFn: () => api.getIdentity(), enabled, retry: 1 });
}
