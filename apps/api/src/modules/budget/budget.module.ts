import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ChainModule } from '../chain/chain.module.js';
import { UsersModule } from '../users/users.module.js';
import { BudgetController } from './budget.controller.js';
import { BudgetService } from './budget.service.js';

@Module({
  imports: [AuthModule, UsersModule, AgentsModule, ChainModule],
  controllers: [BudgetController],
  providers: [BudgetService],
  exports: [BudgetService],
})
export class BudgetModule {}
