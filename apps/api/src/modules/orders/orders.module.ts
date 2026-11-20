import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ChainModule } from '../chain/chain.module.js';
import { MerchantsModule } from '../merchants/merchants.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { UsersModule } from '../users/users.module.js';
import { OrderApprovalEffects } from './order-approval-effects.service.js';
import { OrderApprovalRequests } from './order-approval-request.service.js';
import { OrderConfirmService } from './order-confirm.service.js';
import { OrderViews } from './order-views.service.js';
import { OrderQuoteService } from './order-quote.service.js';
import { OrderRules } from './order-rules.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';
import { OrderSpend } from './order-spend.service.js';

@Module({
  imports: [
    AuthModule,
    AgentsModule,
    UsersModule,
    MerchantsModule,
    ChainModule,
    ApprovalsModule,
    PaymentModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersRepository,
    OrderSpend,
    OrderRules,
    OrderQuoteService,
    OrderConfirmService,
    OrderViews,
    OrderApprovalEffects,
    OrderApprovalRequests,
    OrdersService,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
