import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { BudgetModule } from './modules/budget/budget.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LlmModule } from './modules/llm/llm.module.js';

@Module({
  imports: [ConfigModule, DbModule, HealthModule, LlmModule, BudgetModule],
})
export class AppModule {}
