'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { ORDERS_KEY } from '../../orders/hooks/useOrders';
import { APPROVALS_KEY } from './useApprovals';

/**
 * The owner's answer to one approval: only a person's button calls these. Approving never pays
 * (D-19): the order is quoted again and the answer carries its confirm card. Both answers
 * change the lists, so both are asked again. No automatic retry (CLAUDE.md rule 9).
 */
export function useDecideApproval() {
  const qc = useQueryClient();
  const settled = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: APPROVALS_KEY }),
      qc.invalidateQueries({ queryKey: ORDERS_KEY }),
    ]);
  };
  const approve = useMutation({
    mutationFn: (approvalId: string) => api.approveApproval(approvalId),
    onSettled: settled,
  });
  const reject = useMutation({
    mutationFn: (approvalId: string) => api.rejectApproval(approvalId),
    onSettled: settled,
  });
  return { approve, reject };
}
