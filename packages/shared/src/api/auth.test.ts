import { describe, expect, it } from 'vitest';
import { zPouchiBindBody, zPouchiCompleteBody, zPouchiLoginConfig } from './auth.js';

const T = 'A'.repeat(42) + '_';

describe('Pouchi login schemas (D-29, the Pouchi BFF example shapes)', () => {
  it('the public config has no key field', () => {
    const v = {
      vaultUrl: 'https://auth.pouchi.io',
      appId: 'sikyeoyong',
      callbackUrl: 'http://localhost:3000/pouchi/callback',
    };
    expect(zPouchiLoginConfig.parse(v)).toEqual(v);
    expect(zPouchiLoginConfig.safeParse({ ...v, appKey: 'x' }).success).toBe(false);
  });

  it('bind: 43-character base64url request id and challenge, flow signup only', () => {
    expect(
      zPouchiBindBody.safeParse({ requestId: T, codeChallenge: T, flow: 'signup' }).success,
    ).toBe(true);
    expect(
      zPouchiBindBody.safeParse({ requestId: 'r-1', codeChallenge: T, flow: 'signup' }).success,
    ).toBe(false);
    expect(
      zPouchiBindBody.safeParse({ requestId: `${T}A`, codeChallenge: T, flow: 'signup' }).success,
    ).toBe(false);
    expect(
      zPouchiBindBody.safeParse({ requestId: T, codeChallenge: T, flow: 'sign' }).success,
    ).toBe(false);
  });

  it('complete: exactly request id, envelope and a 43-character verifier', () => {
    const ok = { requestId: T, envelope: 'e', codeVerifier: T };
    expect(zPouchiCompleteBody.safeParse(ok).success).toBe(true);
    expect(
      zPouchiCompleteBody.safeParse({ ...ok, codeVerifier: 'v'.repeat(43) + '!' }).success,
    ).toBe(false);
    expect(zPouchiCompleteBody.safeParse({ ...ok, state: 's' }).success).toBe(false);
    expect(zPouchiCompleteBody.safeParse({ ...ok, userId: 'u1' }).success).toBe(false);
  });
});
