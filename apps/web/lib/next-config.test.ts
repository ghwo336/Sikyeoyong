import { DEFAULT_POUCHI_VAULT_URL } from '@sikyeoyong/shared';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import config, { resolveVaultOrigin, securityHeaders } from '../next.config';
import { proxy } from '../proxy';

const valueOf = (key: string) => securityHeaders.find((h) => h.key === key)?.value;

describe('next.config security headers', () => {
  it('sends nosniff, a strict referrer policy and no framing', () => {
    expect(valueOf('X-Content-Type-Options')).toBe('nosniff');
    expect(valueOf('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(valueOf('X-Frame-Options')).toBe('DENY');
  });

  it('turns off the browser features the app does not use', () => {
    const policy = valueOf('Permissions-Policy') ?? '';
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment']) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it('applies them to every path', async () => {
    const rules = (await config.headers?.()) ?? [];
    expect(rules).toHaveLength(1);
    expect(rules[0]?.source).toBe('/:path*');
    expect(rules[0]?.headers).toEqual(securityHeaders.map((h) => ({ ...h })));
  });
});

describe('login vault origin for the CSP', () => {
  it('root .env wins, then the environment, then the shared default; origin only', () => {
    expect(
      resolveVaultOrigin(
        { POUCHI_VAULT_URL: 'https://env.test' },
        { POUCHI_VAULT_URL: 'https://root.test/a?b' },
      ),
    ).toBe('https://root.test');
    expect(resolveVaultOrigin({ POUCHI_VAULT_URL: 'https://env.test/x' }, {})).toBe(
      'https://env.test',
    );
    expect(resolveVaultOrigin({ POUCHI_VAULT_URL: '  ' }, { POUCHI_VAULT_URL: '' })).toBe(
      new URL(DEFAULT_POUCHI_VAULT_URL).origin,
    );
  });

  it('is handed to the proxy through env, and the proxy uses it (not a fixed default)', () => {
    expect(config.env?.CSP_VAULT_ORIGIN).toMatch(/^https?:\/\/[^/]+$/);
    vi.stubEnv('CSP_VAULT_ORIGIN', 'https://vault.test');
    try {
      const res = proxy(new NextRequest('http://localhost/start'));
      const csp = res.headers.get('content-security-policy') ?? '';
      expect(csp).toContain("connect-src 'self' https://vault.test");
      expect(csp).toContain('frame-src https://vault.test');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
