import type { INestApplication } from '@nestjs/common';
import { API_PREFIX } from './app.constants.js';
import { AppErrorFilter } from './common/filters/app-error.filter.js';

/**
 * The same four headers the web sends (apps/web next.config.ts, security.md): an API answer is
 * never sniffed into another type, never framed, and leaks little in Referer. No CSP here: the
 * API serves JSON only.
 */
export const API_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

/** Shared by main.ts and integration tests so both run the same app setup. */
export function configureApp(app: INestApplication): INestApplication {
  // Behind Caddy (a container on the private docker network, infra.md) or the Next dev proxy
  // (loopback), req.ip must be the client's for per-IP limits (tech-spec 9.5). Forwarded
  // headers are believed only from those addresses, never from the internet.
  const http: unknown = app.getHttpAdapter().getInstance();
  if (typeof http === 'function' && 'set' in http && typeof http.set === 'function') {
    (http.set as (k: string, v: string) => void)('trust proxy', 'loopback, uniquelocal');
  }
  // Before routes and filters, so error answers carry them too.
  app.use(
    (_req: unknown, res: { setHeader(k: string, v: string): void }, next: () => void): void => {
      for (const [k, v] of Object.entries(API_SECURITY_HEADERS)) res.setHeader(k, v);
      next();
    },
  );
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new AppErrorFilter());
  return app;
}
