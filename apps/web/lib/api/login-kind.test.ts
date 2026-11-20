import { describe, expect, it } from 'vitest';
import { loginKindFor } from './login-kind';

describe('loginKindFor (D-29)', () => {
  it('the vault only for the real API without a dev key', () => {
    expect(loginKindFor('http', undefined)).toBe('vault');
    expect(loginKindFor('http', 'hojae')).toBe('direct');
    expect(loginKindFor('mock', undefined)).toBe('direct');
    expect(loginKindFor(undefined, undefined)).toBe('direct');
  });
});
