'use client';

import type { SetLimitsBody } from '@sikyeoyong/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

/**
 * The owner's limit change (D-31, user-flow 5, 12, 13). Only a person's button calls it, after
 * the re-auth step when raising (D-28: the button alone on testnet, a wallet signature with
 * pouch); the dragon only shows the card (D-21). Both limits live in /me and the budget view,
 * so both are asked again (in the background).
 */
export function useSetLimits() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SetLimitsBody) => api.setLimits(body),
    // Not awaited: GET /budget reads the chain and can take a second or more, and the owner's
    // press must not sit in "confirming" until it is back (QA 6 L5). The lists are stale at once,
    // so the next screen that draws them asks again.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] });
      void qc.invalidateQueries({ queryKey: ['budget'] });
    },
  });
}
