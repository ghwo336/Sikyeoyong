'use client';

import type { SetLimitsBody } from '@sikyeoyong/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

/**
 * The owner's limit change (D-31, user-flow 5, 12, 13). Only a person's button calls it, after
 * the re-auth step when raising (D-28: the button alone on testnet, a wallet signature with
 * pouch); the dragon only shows the card (D-21). Both limits live in /me and the budget view,
 * so both are asked again.
 */
export function useSetLimits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetLimitsBody) => api.setLimits(body),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['me'] }),
        qc.invalidateQueries({ queryKey: ['budget'] }),
      ]);
    },
  });
}
