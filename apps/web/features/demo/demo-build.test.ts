import { describe, expect, it } from 'vitest';
import { isDemoBuild } from './demo-build';

describe('isDemoBuild', () => {
  it('is on only for "true" (any case, trimmed)', () => {
    expect(isDemoBuild('true')).toBe(true);
    expect(isDemoBuild(' TRUE ')).toBe(true);
  });

  it('is off for everything else, including unset and empty', () => {
    for (const v of [undefined, '', 'false', '1', 'yes', 'on']) expect(isDemoBuild(v)).toBe(false);
  });
});
