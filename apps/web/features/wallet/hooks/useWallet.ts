'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BudgetView } from '@sikyeoyong/shared';
import { api } from '../../../lib/api';

/** Wallet.dc.html money: owner's allowance, the dragon's pocket, saved this month. */
export function useWallet() {
  return useQuery({ queryKey: ['wallet'], queryFn: () => api.getWallet() });
}

/** IdCard.dc.html: owner, identity check, birth. */
export function useIdCard() {
  return useQuery({ queryKey: ['id-card'], queryFn: () => api.getIdCard() });
}

/**
 * 용이 멈추기 / 깨우기. The budget view carries `frozen`: on success it is written into the cache
 * at once and asked again in the background, so the screen moves without waiting for that
 * request (GET /budget also reads the chain and can be slow; browser QA left the switch on
 * /dragon until a reload).
 */
export function useSetFrozen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (frozen: boolean) => api.setFrozen(frozen),
    onSuccess: (_r, frozen) => {
      qc.setQueryData<BudgetView>(['budget'], (old) => (old ? { ...old, frozen } : old));
      void qc.invalidateQueries({ queryKey: ['budget'] });
    },
  });
}

/** 돌려받기: the pocket goes back to the owner's allowance. */
export function useRefundPocket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.refundPocket(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wallet'] }),
  });
}
