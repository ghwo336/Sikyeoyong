// The vault origin comes from next.config.ts `env` (CSP_VAULT_ORIGIN: root .env, then the
// environment, then the shared default), the same value the API uses.
// Runs before every page: a fresh nonce, the CSP built from it (lib/csp.ts), and the nonce on the
// request so Next puts it on its own inline scripts. Page routes only: assets and the API
// (/api goes to the API server) need no policy.
import { type NextRequest, NextResponse } from 'next/server';
import { buildCsp, createNonce, vaultOriginFrom } from './lib/csp';

export function proxy(request: NextRequest): NextResponse {
  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    dev: process.env.NODE_ENV === 'development',
    vaultOrigin: vaultOriginFrom(process.env.CSP_VAULT_ORIGIN),
  });
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
