'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { type OwnerApproval, ownerApprovals } from '../owner';

export const APPROVALS_KEY = ['approvals'] as const;

/** How often the list is asked again while one waits (an approval lapses after 10 minutes). */
export const APPROVALS_POLL_MS = 30_000;

/** The owner's pending yes-or-no cards (GET /approvals?status=pending), per-order waits left out. */
export function useOwnerApprovals() {
  return useQuery({
    queryKey: APPROVALS_KEY,
    queryFn: () => api.listApprovals(),
    select: (data): OwnerApproval[] => ownerApprovals(data.approvals),
    refetchInterval: (q) => ((q.state.data?.approvals.length ?? 0) > 0 ? APPROVALS_POLL_MS : false),
  });
}
