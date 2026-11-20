'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';

/** The signed-in owner and their dragon (GET /me). */
export function useMe() {
  // A 401 or 404 is an answer (where to go), not a hiccup to retry.
  return useQuery({ queryKey: ['me'], queryFn: () => api.getMe(), retry: false });
}
