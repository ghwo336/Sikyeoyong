'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

/** Wallet.dc.html money: owner's allowance, the dragon's pocket, saved this month. */
export function useWallet() {
  return useQuery({ queryKey: ['wallet'], queryFn: () => api.getWallet() });
}

/** IdCard.dc.html: owner, identity check, birth. */
export function useIdCard() {
  return useQuery({ queryKey: ['id-card'], queryFn: () => api.getIdCard() });
}

/** 용이 멈추기 / 깨우기: the budget view carries `frozen`, so it is asked again. */
export function useSetFrozen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (frozen: boolean) => api.setFrozen(frozen),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget'] }),
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
