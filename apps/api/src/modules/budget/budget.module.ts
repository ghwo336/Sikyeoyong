import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { ChainModule } from '../chain/chain.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { UsersModule } from '../users/users.module.js';
import { BudgetService } from './budget.service.js';

@Module({
  imports: [UsersModule, AgentsModule, OrdersModule, ChainModule],
  providers: [BudgetService],
  exports: [BudgetService],
})
export class BudgetModule {}
