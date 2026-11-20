import type { INestApplication } from '@nestjs/common';
import { API_PREFIX } from './app.constants.js';
import { AppErrorFilter } from './common/filters/app-error.filter.js';

/** Shared by main.ts and integration tests so both run the same app setup. */
export function configureApp(app: INestApplication): INestApplication {
  // Behind Caddy (a container on the private docker network, infra.md) or the Next dev proxy
  // (loopback), req.ip must be the client's for per-IP limits (tech-spec 9.5). Forwarded
  // headers are believed only from those addresses, never from the internet.
  const http: unknown = app.getHttpAdapter().getInstance();
  if (typeof http === 'function' && 'set' in http && typeof http.set === 'function') {
    (http.set as (k: string, v: string) => void)('trust proxy', 'loopback, uniquelocal');
  }
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new AppErrorFilter());
  return app;
}
