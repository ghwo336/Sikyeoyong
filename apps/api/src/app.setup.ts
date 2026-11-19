import type { INestApplication } from '@nestjs/common';
import { API_PREFIX } from './app.constants.js';

/** Shared by main.ts and integration tests so both run the same app setup. */
export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix(API_PREFIX);
  return app;
}
