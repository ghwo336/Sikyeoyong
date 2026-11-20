'use client';

import type { DragonSpecies } from '@sikyeoyong/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type AokrwString } from '../../../lib/api';
import { hatchPollInterval } from '../hatch';

/** Sign-up settings: which identity check, how much trial allowance (D-16). */
export function useSignupConfig() {
  return useQuery({ queryKey: ['signup-config'], queryFn: () => api.getSignupConfig() });
}

/** Start: Kakao or Google login. */
export function useLogin() {
  return useMutation({ mutationFn: (provider: 'kakao' | 'google') => api.login(provider) });
}

/** Verify: the Kakao identity check. */
export function useVerifyIdentity() {
  return useMutation({ mutationFn: () => api.verifyIdentity() });
}

/** Name: hatch a dragon with this name and species (POST /agents). */
export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { dragonName: string; dragonSpecies: DragonSpecies }) =>
      api.createAgent(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['agent-setup'] });
    },
  });
}

/** Hatch: the three setup steps, asked again every second while setup is running. */
export function useAgentSetup(enabled = true) {
  return useQuery({
    queryKey: ['agent-setup'],
    enabled,
    queryFn: () => api.getAgentSetup(),
    // The rule (including what a failed GET does) lives in hatchPollInterval.
    refetchInterval: (q) => hatchPollInterval(q.state.data?.status),
    staleTime: 0,
  });
}

export function useRetryAgentSetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.retryAgentSetup(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-setup'] }),
  });
}

/** Budget: save this month's budget. */
export function useSetMonthlyBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (amount: AokrwString) => api.setMonthlyBudget(amount),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget'] }),
  });
}

/** Budget: the trial allowance (not a payment, no order). */
export function useClaimTrialAllowance() {
  return useMutation({ mutationFn: () => api.claimTrialAllowance() });
}
