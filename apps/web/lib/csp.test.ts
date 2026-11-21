import { describe, expect, it } from 'vitest';
import { buildCsp, createNonce, DEFAULT_VAULT_ORIGIN, vaultOriginFrom } from './csp';

const directive = (csp: string, name: string) =>
  csp.split('; ').find((d) => d.startsWith(`${name} `) || d === name);

describe('buildCsp', () => {
  const nonce = createNonce();

  it('production: nonce + strict-dynamic, no unsafe-eval, no unsafe-inline script', () => {
    const script = directive(buildCsp({ nonce, dev: false }), 'script-src') ?? '';
    expect(script).toContain(`'nonce-${nonce}'`);
    expect(script).toContain("'strict-dynamic'");
    expect(script.split(' ')).not.toContain("'unsafe-eval'");
    expect(script).not.toContain("'unsafe-inline'");
  });

  it('development adds unsafe-eval and websockets only there', () => {
    const dev = buildCsp({ nonce, dev: true });
    const prod = buildCsp({ nonce, dev: false });
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(dev, 'connect-src')).toContain('ws:');
    expect(prod).not.toContain('ws:');
    expect(prod).toContain('upgrade-insecure-requests');
    expect(dev).not.toContain('upgrade-insecure-requests');
  });

  it('connect-src allows the same-origin API and the vault, frames only the vault', () => {
    const csp = buildCsp({ nonce, dev: false, vaultOrigin: 'https://vault.test' });
    expect(directive(csp, 'connect-src')).toBe("connect-src 'self' https://vault.test");
    expect(directive(csp, 'frame-src')).toBe('frame-src https://vault.test');
  });

  it('forbids framing, plugins and foreign base URIs', () => {
    const csp = buildCsp({ nonce, dev: false });
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    expect(directive(csp, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(csp, 'default-src')).toBe("default-src 'self'");
  });

  it('break: a nonce that could end the directive is refused', () => {
    for (const bad of ["a'; script-src *", 'a b', '', 'a;b', "x' 'unsafe-inline"]) {
      expect(() => buildCsp({ nonce: bad, dev: false })).toThrow();
    }
  });
});

describe('createNonce', () => {
  it('is base64 and differs every call', () => {
    const seen = new Set(Array.from({ length: 50 }, createNonce));
    expect(seen.size).toBe(50);
    for (const n of seen) expect(n).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe('vaultOriginFrom', () => {
  it('takes the origin, and falls back for empty, junk or non-http values', () => {
    expect(vaultOriginFrom('https://vault.test/path?x=1')).toBe('https://vault.test');
    for (const v of [undefined, '', '  ', 'nope', 'javascript:alert(1)']) {
      expect(vaultOriginFrom(v)).toBe(DEFAULT_VAULT_ORIGIN);
    }
  });
});
