import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ChainModule } from '../chain/chain.module.js';
import { MerchantsModule } from '../merchants/merchants.module.js';
import { UsersModule } from '../users/users.module.js';
import { OrderQuoteService } from './order-quote.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [AuthModule, AgentsModule, UsersModule, MerchantsModule, ChainModule, ApprovalsModule],
  controllers: [OrdersController],
  providers: [OrdersRepository, OrdersService, OrderQuoteService],
  exports: [OrdersService, OrderQuoteService],
})
export class OrdersModule {}
