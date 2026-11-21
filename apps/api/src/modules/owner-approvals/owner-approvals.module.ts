import { Module } from '@nestjs/common';
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module.js';
import { ApprovalsModule } from '../approvals/approvals.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { OwnerApprovalsController } from './owner-approvals.controller.js';
import { OwnerApprovalsService } from './owner-approvals.service.js';

/** The owner's decisions on approvals (joins approvals and orders, server-api.md). */
@Module({
  imports: [RateLimitModule, AuthModule, ApprovalsModule, OrdersModule],
  controllers: [OwnerApprovalsController],
  providers: [OwnerApprovalsService],
})
export class OwnerApprovalsModule {}
