import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { APP_CONFIG } from './config/config.module.js';
import type { AppConfig } from './config/env.js';

// Local development reads the repo root .env (servers set real env vars instead).
const ENV_FILE = resolve(__dirname, '../../../.env');
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();
  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.port);
}

void bootstrap();
