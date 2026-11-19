import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LlmModule } from './modules/llm/llm.module.js';

@Module({
  imports: [ConfigModule, DbModule, HealthModule, LlmModule],
})
export class AppModule {}
