'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type OrderQuote } from '../../../lib/api';
import { ORDERS_KEY } from '../../orders/hooks/useOrders';
import { APPROVALS_KEY } from './useApprovals';

/**
 * The owner's answer to one approval: only a person's button calls these. Approving never pays
 * (D-19): the order is quoted again and the answer carries its confirm card. Both answers
 * change the lists, so both are asked again. No automatic retry (CLAUDE.md rule 9).
 */
export function useDecideApproval(
  on: {
    /** The order's confirm card after a yes. */
    readonly onQuote?: (quote: OrderQuote) => void;
    /** After a no, once the server has stopped the order. */
    readonly onRejected?: () => void;
  } = {},
) {
  const qc = useQueryClient();
  const settled = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: APPROVALS_KEY }),
      qc.invalidateQueries({ queryKey: ORDERS_KEY }),
    ]);
  };
  const approve = useMutation({
    mutationFn: (approvalId: string) => api.approveApproval(approvalId),
    // Here, not in mutate(): the answer takes its own card away (the lists are asked again
    // below), and a per-call callback is dropped once the card is gone. The sheet must open.
    onSuccess: (res) => {
      if (res.quote) on.onQuote?.(res.quote);
    },
    onSettled: settled,
  });
  const reject = useMutation({
    mutationFn: (approvalId: string) => api.rejectApproval(approvalId),
    onSuccess: () => {
      on.onRejected?.();
    },
    onSettled: settled,
  });
  return { approve, reject };
}
