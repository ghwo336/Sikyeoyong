import { Global, Module } from '@nestjs/common';
import { loadConfig } from './env.js';

/** Injection token for AppConfig. Every module reads settings through this, never process.env. */
export const APP_CONFIG = Symbol('APP_CONFIG');

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
