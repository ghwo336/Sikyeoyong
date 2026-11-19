import { describe, expect, it } from 'vitest';
import { DRAGON_SPECIES, isDragonSpecies, zDragonSpecies } from './dragon.js';

describe('DragonSpecies (D-20)', () => {
  it('has the four species in the decision order', () => {
    expect(DRAGON_SPECIES).toEqual(['forest', 'water', 'flower', 'star']);
  });

  it.each(['forest', 'water', 'flower', 'star'])('accepts %s', (s) => {
    expect(isDragonSpecies(s)).toBe(true);
    expect(zDragonSpecies.safeParse(s).success).toBe(true);
  });

  it.each(['green', 'sky', 'Forest', '', 'toString', 1, null])(
    'rejects %j (old colors included)',
    (s) => {
      expect(isDragonSpecies(s)).toBe(false);
      expect(zDragonSpecies.safeParse(s).success).toBe(false);
    },
  );
});
