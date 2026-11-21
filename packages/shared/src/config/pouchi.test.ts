import { describe, expect, it } from 'vitest';
import { DEFAULT_POUCHI_BRIDGE_ISSUER, DEFAULT_POUCHI_VAULT_URL } from './pouchi.js';

describe('pouchi defaults', () => {
  it('are https origins without a path', () => {
    for (const v of [DEFAULT_POUCHI_VAULT_URL, DEFAULT_POUCHI_BRIDGE_ISSUER]) {
      expect(new URL(v).protocol).toBe('https:');
      expect(new URL(v).origin).toBe(v);
    }
  });
});
