import { Module } from '@nestjs/common';
import { RateLimitModule } from './common/rate-limit/rate-limit.module.js';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { BudgetModule } from './modules/budget/budget.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LlmModule } from './modules/llm/llm.module.js';
import { MerchantsModule } from './modules/merchants/merchants.module.js';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    RateLimitModule,
    HealthModule,
    LlmModule,
    BudgetModule,
    MerchantsModule,
  ],
})
export class AppModule {}
