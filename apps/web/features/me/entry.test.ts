import { describe, expect, it } from 'vitest';
import { AppError } from '@sikyeoyong/shared';
import { entryRoute, retryMe } from './entry';

describe('entryRoute (user-flow 1 to 4)', () => {
  it('sends someone not signed in to Start, and someone without a dragon to Name', () => {
    expect(entryRoute({ meError: 'UNAUTHENTICATED', hasMe: false })).toBe('/start');
    expect(entryRoute({ meError: 'NOT_FOUND', hasMe: false, verified: true })).toBe('/name');
    expect(entryRoute({ meError: 'NOT_FOUND', hasMe: false, verified: false })).toBe('/verify');
    // No dragon and the identity answer not in yet: wait.
    expect(entryRoute({ meError: 'NOT_FOUND', hasMe: false })).toBeUndefined();
  });

  it('sends a dragon still hatching, or failed, to Hatch; a hatched one stays', () => {
    expect(entryRoute({ hasMe: true, setupStatus: 'PENDING' })).toBe('/hatch');
    expect(entryRoute({ hasMe: true, setupStatus: 'FAILED' })).toBe('/hatch');
    expect(entryRoute({ hasMe: true, setupStatus: 'ACTIVE' })).toBeNull();
  });

  it('waits while loading', () => {
    expect(entryRoute({ hasMe: false })).toBeUndefined();
    expect(entryRoute({ hasMe: true })).toBeUndefined();
  });

  it('on any other error stays, so the screen shows its own error (never a blank page)', () => {
    expect(entryRoute({ meError: 'INTERNAL', hasMe: false })).toBeNull();
    expect(entryRoute({ meError: 'RATE_LIMITED', hasMe: false })).toBeNull();
  });
});

describe('retryMe', () => {
  it('does not retry the answers 401 and 404', () => {
    expect(retryMe(0, new AppError('UNAUTHENTICATED'))).toBe(false);
    expect(retryMe(0, new AppError('NOT_FOUND'))).toBe(false);
  });

  it('retries other failures up to three times', () => {
    expect(retryMe(0, new AppError('INTERNAL'))).toBe(true);
    expect(retryMe(2, new TypeError('offline'))).toBe(true);
    expect(retryMe(3, new AppError('INTERNAL'))).toBe(false);
  });
});
