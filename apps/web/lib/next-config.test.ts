import { describe, expect, it } from 'vitest';
import config, { securityHeaders } from '../next.config';

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
