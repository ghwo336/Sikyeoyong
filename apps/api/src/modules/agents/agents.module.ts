import { Module } from '@nestjs/common';
import { AllowanceModule } from '../allowance/allowance.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { AgentFreezeService } from './agent-freeze.service.js';
import { AgentLock } from './agent-lock.service.js';
import { AgentLevelService } from './agent-level.service.js';
import { AgentRefundService } from './agent-refund.service.js';
import { AgentSetupService } from './agent-setup.service.js';
import { AgentsController } from './agents.controller.js';
import { AgentsRepository } from './agents.repository.js';
import { AgentsService } from './agents.service.js';

@Module({
  imports: [AuthModule, PaymentModule, IdentityModule, AllowanceModule],
  controllers: [AgentsController],
  providers: [
    AgentsRepository,
    AgentsService,
    AgentSetupService,
    AgentLevelService,
    AgentFreezeService,
    AgentRefundService,
    AgentLock,
  ],
  exports: [AgentsService],
})
export class AgentsModule {}
