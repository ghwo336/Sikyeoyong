import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import type { NextConfig } from 'next';
import { vaultOriginFrom } from './lib/csp';

// Local development shares the repo root .env with apps/api. It is parsed here
// instead of loaded into process.env: `next dev --port 3000` sets PORT=3000 for
// itself, so the API port must come from the file (or API_DEV_ORIGIN).
const ROOT_ENV = resolve(import.meta.dirname, '../../.env');
const rootEnv = existsSync(ROOT_ENV) ? parseEnv(readFileSync(ROOT_ENV, 'utf8')) : {};

// In production Caddy sends /api to the API server on the same domain (D-03).
// In development Next forwards /api to the local API so cookies stay same-origin.
// An empty value (`API_DEV_ORIGIN=` in .env.example) means "not set", as in apps/api.
const set = (v: string | undefined): string | undefined => (v?.trim() ? v.trim() : undefined);
const API_DEV_ORIGIN =
  set(process.env.API_DEV_ORIGIN) ??
  set(rootEnv.API_DEV_ORIGIN) ??
  `http://localhost:${set(rootEnv.PORT) ?? '8787'}`;

// mock (default) or http: which ApiClient the screens use (lib/api/index.ts). Read like
// API_DEV_ORIGIN so the root .env works; inlined into the bundle at build time.
const API_MODE =
  set(process.env.NEXT_PUBLIC_API_MODE) ?? set(rootEnv.NEXT_PUBLIC_API_MODE) ?? 'mock';

// Demo scenes (the key leak comparison) exist only in a demo build: NEXT_PUBLIC_DEMO_MODE, or the
// root .env DEMO_MODE the API reads. Anything but "true" leaves /demo/* as a 404.
const DEMO_MODE =
  set(process.env.NEXT_PUBLIC_DEMO_MODE) ??
  set(rootEnv.NEXT_PUBLIC_DEMO_MODE) ??
  set(rootEnv.DEMO_MODE) ??
  'false';

/**
 * The login vault origin the CSP allows (proxy.ts). Same variable and order as the API reads
 * (POUCHI_VAULT_URL): the root .env, then the environment, then the shared default. An
 * origin only (a public value, never a secret).
 */
export function resolveVaultOrigin(
  env: Record<string, string | undefined>,
  root: Record<string, string | undefined>,
): string {
  return vaultOriginFrom(set(root.POUCHI_VAULT_URL) ?? set(env.POUCHI_VAULT_URL));
}

// Headers on every response (security.md "웹 응답 헤더"). The Content-Security-Policy is not here:
// it needs a per-request nonce, so proxy.ts sets it (lib/csp.ts).
export const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Nothing in the app needs these browser features.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
] as const;

const config: NextConfig = {
  reactStrictMode: true,
  // `pnpm demo:rehearse` runs its own next dev beside a developer's (one lock per distDir).
  distDir: set(process.env.NEXT_DIST_DIR) ?? '.next',
  env: {
    NEXT_PUBLIC_DEMO_MODE: DEMO_MODE,
    NEXT_PUBLIC_API_MODE: API_MODE,
    CSP_VAULT_ORIGIN: resolveVaultOrigin(process.env, rootEnv),
    NEXT_PUBLIC_DEV_LOGIN_KEY:
      set(process.env.NEXT_PUBLIC_DEV_LOGIN_KEY) ?? set(rootEnv.NEXT_PUBLIC_DEV_LOGIN_KEY) ?? '',
  },
  // packages/ui ships TypeScript and CSS sources (architecture.md).
  transpilePackages: ['@sikyeoyong/ui'],
  poweredByHeader: false,
  // next dev writes an AGENTS.md (with em dashes) when run by a coding agent; keep the tree clean.
  agentRules: false,
  devIndicators: false,
  headers() {
    return Promise.resolve([
      { source: '/:path*', headers: securityHeaders.map((h) => ({ ...h })) },
    ]);
  },
  rewrites() {
    if (process.env.NODE_ENV !== 'development') return Promise.resolve([]);
    return Promise.resolve([
      { source: '/api/:path*', destination: `${API_DEV_ORIGIN}/api/:path*` },
    ]);
  },
};

export default config;
