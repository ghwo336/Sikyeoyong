import { Module } from '@nestjs/common';
import { RateLimitModule } from './common/rate-limit/rate-limit.module.js';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { BudgetModule } from './modules/budget/budget.module.js';
import { DemoModule } from './modules/demo/demo.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { LimitsModule } from './modules/limits/limits.module.js';
import { LlmModule } from './modules/llm/llm.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WalletModule } from './modules/wallet/wallet.module.js';
import { MerchantsModule } from './modules/merchants/merchants.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { OwnerApprovalsModule } from './modules/owner-approvals/owner-approvals.module.js';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    RateLimitModule,
    HealthModule,
    IdentityModule,
    LimitsModule,
    LlmModule,
    BudgetModule,
    UsersModule,
    MerchantsModule,
    OrdersModule,
    OwnerApprovalsModule,
    WalletModule,
    DemoModule,
  ],
})
export class AppModule {}
