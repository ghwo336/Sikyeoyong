'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { retryMe } from '../entry';

/** The signed-in owner and their dragon (GET /me). */
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api.getMe(), retry: retryMe });
}
