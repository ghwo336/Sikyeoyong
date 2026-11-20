import { describe, expect, it } from 'vitest';
import { zPouchiBindBody, zPouchiCompleteBody, zPouchiLoginConfig } from './auth.js';

describe('Pouchi login schemas (D-29)', () => {
  it('the public config has no key field', () => {
    const v = {
      vaultUrl: 'https://auth.pouchi.io',
      appId: 'sikyeoyong',
      callbackUrl: 'http://localhost:3000/pouchi/callback',
    };
    expect(zPouchiLoginConfig.parse(v)).toEqual(v);
    expect(zPouchiLoginConfig.safeParse({ ...v, appKey: 'x' }).success).toBe(false);
  });

  it('bind takes a request id, a challenge and signup or login', () => {
    expect(
      zPouchiBindBody.safeParse({ requestId: 'r-1', codeChallenge: 'c', flow: 'signup' }).success,
    ).toBe(true);
    expect(
      zPouchiBindBody.safeParse({ requestId: 'r 1', codeChallenge: 'c', flow: 'signup' }).success,
    ).toBe(false);
    expect(
      zPouchiBindBody.safeParse({ requestId: 'r-1', codeChallenge: 'c', flow: 'sign' }).success,
    ).toBe(false);
  });

  it('complete needs a PKCE-length verifier (43 to 128)', () => {
    const ok = { envelope: 'e', codeVerifier: 'v'.repeat(43), requestId: 'r-1' };
    expect(zPouchiCompleteBody.safeParse(ok).success).toBe(true);
    expect(zPouchiCompleteBody.safeParse({ ...ok, codeVerifier: 'short' }).success).toBe(false);
    expect(zPouchiCompleteBody.safeParse({ ...ok, userId: 'u1' }).success).toBe(false);
  });
});
