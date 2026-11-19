import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import type { NextConfig } from 'next';

// Local development shares the repo root .env with apps/api. It is parsed here
// instead of loaded into process.env: `next dev --port 3000` sets PORT=3000 for
// itself, so the API port must come from the file (or API_DEV_ORIGIN).
const ROOT_ENV = resolve(import.meta.dirname, '../../.env');
const rootEnv = existsSync(ROOT_ENV) ? parseEnv(readFileSync(ROOT_ENV, 'utf8')) : {};

// In production Caddy sends /api to the API server on the same domain (D-03).
// In development Next forwards /api to the local API so cookies stay same-origin.
const API_DEV_ORIGIN =
  process.env.API_DEV_ORIGIN ??
  rootEnv.API_DEV_ORIGIN ??
  `http://localhost:${rootEnv.PORT ?? '8787'}`;

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // next dev writes an AGENTS.md (with em dashes) when run by a coding agent; keep the tree clean.
  agentRules: false,
  rewrites() {
    if (process.env.NODE_ENV !== 'development') return Promise.resolve([]);
    return Promise.resolve([
      { source: '/api/:path*', destination: `${API_DEV_ORIGIN}/api/:path*` },
    ]);
  },
};

export default config;
