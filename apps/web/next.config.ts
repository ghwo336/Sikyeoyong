import type { NextConfig } from 'next';

// In production Caddy sends /api to the API server on the same domain (D-03).
// In development Next forwards /api to the local API so cookies stay same-origin.
const API_DEV_ORIGIN = process.env.API_DEV_ORIGIN ?? 'http://localhost:8787';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  rewrites() {
    if (process.env.NODE_ENV !== 'development') return Promise.resolve([]);
    return Promise.resolve([
      { source: '/api/:path*', destination: `${API_DEV_ORIGIN}/api/:path*` },
    ]);
  },
};

export default config;
