import { z } from 'zod';

/**
 * Dragon faces the server may ask for (OrderView.dragonMood). Same values as
 * packages/ui Dragon `DragonMood`; apps/web checks the two stay equal.
 */
export const DRAGON_MOODS = [
  'default',
  'happy',
  'excited',
  'worried',
  'hiding',
  'sleeping',
  'eating',
  'cooking',
] as const;

export type DragonMoodKey = (typeof DRAGON_MOODS)[number];

export const zDragonMood = z.enum(DRAGON_MOODS);
