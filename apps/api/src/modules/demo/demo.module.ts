import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { DemoController } from './demo.controller.js';
import { DemoLeakService } from './demo-leak.service.js';

/** Demo-only read views (DEMO_MODE). Nothing here moves money. */
@Module({
  imports: [AuthModule, AgentsModule, PaymentModule],
  controllers: [DemoController],
  providers: [DemoLeakService],
})
export class DemoModule {}
