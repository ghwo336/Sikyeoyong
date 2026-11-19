'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';

/** This month's budget and the dragon's limits (GET /budget, BudgetView). */
export function useBudget() {
  return useQuery({ queryKey: ['budget'], queryFn: () => api.getBudget() });
}
