// The Content-Security-Policy of every page response (security.md "웹 응답 헤더"). Built per
// request in proxy.ts because the nonce must differ each time; the other four security headers
// stay in next.config.ts (one place per header, no CSP there).

import { DEFAULT_POUCHI_VAULT_URL } from '@sikyeoyong/shared';

export interface CspOptions {
  nonce: string;
  dev: boolean;
  /** Origin of the Pouchi login vault (POUCHI_VAULT_URL). It opens in an iframe and is called. */
  vaultOrigin?: string;
}

/** The vault the API hands to the login flow when POUCHI_VAULT_URL is empty (shared config). */
export const DEFAULT_VAULT_ORIGIN = new URL(DEFAULT_POUCHI_VAULT_URL).origin;

/** A fresh unguessable value for one response: 16 random bytes, base64. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/** The origin of a URL setting, or the default when it is empty or not an http(s) URL. */
export function vaultOriginFrom(value: string | undefined): string {
  try {
    const url = new URL(value?.trim() ?? '');
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.origin
      : DEFAULT_VAULT_ORIGIN;
  } catch {
    return DEFAULT_VAULT_ORIGIN;
  }
}

export function buildCsp({ nonce, dev, vaultOrigin = DEFAULT_VAULT_ORIGIN }: CspOptions): string {
  // The nonce is base64 (A-Z a-z 0-9 + / =). Anything else could end the directive early.
  if (!/^[A-Za-z0-9+/]+=*$/.test(nonce)) throw new Error('CSP nonce must be base64');
  const directives: [string, string[]][] = [
    ['default-src', ["'self'"]],
    [
      'script-src',
      [
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        // The login SDK runs WebAssembly. React's dev-only debugging needs eval (never in prod).
        "'wasm-unsafe-eval'",
        ...(dev ? ["'unsafe-eval'"] : []),
      ],
    ],
    // React and the screens set style attributes, which only 'unsafe-inline' allows.
    ['style-src', ["'self'", "'unsafe-inline'"]],
    // The API is the same origin (Caddy in production, a rewrite in dev), so 'self' covers it.
    ['connect-src', ["'self'", vaultOrigin, ...(dev ? ['ws:', 'wss:'] : [])]],
    ['frame-src', [vaultOrigin]],
    ['img-src', ["'self'", 'data:', 'blob:']],
    ['font-src', ["'self'", 'data:']],
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
    ...(dev ? [] : [['upgrade-insecure-requests', []] as [string, string[]]]),
  ];
  return directives.map(([name, values]) => [name, ...values].join(' ')).join('; ');
}
