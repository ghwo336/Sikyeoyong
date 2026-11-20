'use client';

import { useEffect } from 'react';
import { applySpecies } from '../../../lib/theme';
import { useMeCached } from '../hooks/useMe';

/**
 * Paints the app in the dragon's species (D-32) whenever GET /me gives a new one: after
 * sign-in, and after the Look screen saves. Draws nothing and never asks /me on its own.
 */
export function ThemeSync() {
  const species = useMeCached().data?.dragonSpecies;
  useEffect(() => {
    if (species !== undefined) applySpecies(species);
  }, [species]);
  return null;
}
