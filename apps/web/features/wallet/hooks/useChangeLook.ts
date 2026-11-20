'use client';

import type { DragonSpecies } from '@sikyeoyong/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type MeView } from '../../../lib/api';

/**
 * 이 모습으로 바꾸기 (Look.dc.html, D-32): PATCH /agents/:id, then GET /me is asked again so the
 * header, the Wallet row and the theme (ThemeSync) follow. The answer goes into the cache first,
 * so nothing waits for that second round trip.
 */
export function useChangeLook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { readonly agentId: string; readonly species: DragonSpecies }) =>
      api.patchAgent(v.agentId, { dragonSpecies: v.species }),
    onSuccess: ({ dragonSpecies }) => {
      qc.setQueryData<MeView>(['me'], (me) => (me ? { ...me, dragonSpecies } : me));
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
