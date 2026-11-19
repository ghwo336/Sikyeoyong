import { z } from 'zod';

/**
 * Dragon species (decisions D-20). Each egg is a species, not just a color:
 * forest 숲용, water 물용, flower 꽃용, star 별용. Look and lines live in
 * design/screens/Dragons.dc.html and design/tokens.json dragonSpecies.
 * Species is decoration only: it never affects payment, limits or the chain.
 */
export const DRAGON_SPECIES = ['forest', 'water', 'flower', 'star'] as const;

export type DragonSpecies = (typeof DRAGON_SPECIES)[number];

/** For API bodies (POST /api/agents dragonSpecies) and the agents.dragon_species column. */
export const zDragonSpecies = z.enum(DRAGON_SPECIES);

export function isDragonSpecies(value: unknown): value is DragonSpecies {
  return typeof value === 'string' && (DRAGON_SPECIES as readonly string[]).includes(value);
}
