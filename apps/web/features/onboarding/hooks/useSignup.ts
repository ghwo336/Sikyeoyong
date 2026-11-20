'use client';

import { startSession } from '../../../lib/session/entry';
import type { DragonSpecies } from '@sikyeoyong/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type AokrwString } from '../../../lib/api';
import { hatchPollInterval } from '../hatch';

/** Sign-up settings: which identity check, how much trial allowance (D-16). */
export function useSignupConfig() {
  return useQuery({ queryKey: ['signup-config'], queryFn: () => api.getSignupConfig() });
}

/** Start: "이메일로 시작하기" (D-29, the one session entry). */
export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    // The one session entry (D-29): the vault or the direct login, decided in lib/session.
    mutationFn: () => startSession(),
    // A 401 kept from before the login must not send the front door back to Start.
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['me'] });
      qc.removeQueries({ queryKey: ['identity'] });
    },
  });
}

/** Verify: the Kakao identity check. */
export function useVerifyIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.verifyIdentity(),
    // The front door must not send a verified owner back to Verify on an old answer.
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['identity'] });
    },
  });
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
