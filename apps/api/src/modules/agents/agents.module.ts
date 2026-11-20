import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { AgentLevelService } from './agent-level.service.js';
import { AgentSetupService } from './agent-setup.service.js';
import { AgentsController } from './agents.controller.js';
import { AgentsRepository } from './agents.repository.js';
import { AgentsService } from './agents.service.js';

@Module({
  imports: [AuthModule, PaymentModule, IdentityModule],
  controllers: [AgentsController],
  providers: [AgentsRepository, AgentsService, AgentSetupService, AgentLevelService],
  exports: [AgentsService],
})
export class AgentsModule {}
