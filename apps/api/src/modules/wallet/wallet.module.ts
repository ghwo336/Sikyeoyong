import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { AllowanceModule } from '../allowance/allowance.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { UsersModule } from '../users/users.module.js';
import { WalletController } from './wallet.controller.js';
import { WalletService } from './wallet.service.js';

/** The wallet screen's money view. Reads only; moving money stays in its own modules. */
@Module({
  imports: [AuthModule, AgentsModule, AllowanceModule, OrdersModule, PaymentModule, UsersModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
