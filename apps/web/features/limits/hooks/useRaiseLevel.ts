'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

/**
 * The owner's level raise (user-flow 12, 13). Only a person's button calls it, after the
 * re-auth step (Q-36); the dragon only shows the card (D-21). The level and the per-order
 * limit live in /me and the budget view, so both are asked again.
 */
export function useRaiseLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (level: 1 | 2 | 3) => api.raiseLevel(level),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['me'] }),
        qc.invalidateQueries({ queryKey: ['budget'] }),
      ]);
    },
  });
}
