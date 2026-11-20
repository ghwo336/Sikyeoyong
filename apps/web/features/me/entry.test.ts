import { describe, expect, it } from 'vitest';
import { entryRoute } from './entry';

describe('entryRoute (user-flow 1 to 4)', () => {
  it('sends someone not signed in to Start, and someone without a dragon to Name', () => {
    expect(entryRoute({ meError: 'UNAUTHENTICATED', hasMe: false })).toBe('/start');
    expect(entryRoute({ meError: 'NOT_FOUND', hasMe: false })).toBe('/name');
  });

  it('sends a dragon still hatching, or failed, to Hatch; a hatched one stays', () => {
    expect(entryRoute({ hasMe: true, setupStatus: 'PENDING' })).toBe('/hatch');
    expect(entryRoute({ hasMe: true, setupStatus: 'FAILED' })).toBe('/hatch');
    expect(entryRoute({ hasMe: true, setupStatus: 'ACTIVE' })).toBeNull();
  });

  it('waits while loading, and on any other error (the screen shows its own error)', () => {
    expect(entryRoute({ hasMe: false })).toBeUndefined();
    expect(entryRoute({ hasMe: true })).toBeUndefined();
    expect(entryRoute({ meError: 'INTERNAL', hasMe: false })).toBeUndefined();
  });
});
