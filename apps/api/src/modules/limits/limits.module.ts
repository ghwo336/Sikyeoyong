import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { LimitsController } from './limits.controller.js';
import { LimitsService } from './limits.service.js';

/**
 * The owner changes the two limits (D-31): the per-order one on the chain through the agents
 * module, the 30-day one in the users module. Its own module because both of those are needed
 * and users already imports agents.
 */
@Module({
  imports: [AuthModule, AgentsModule, UsersModule],
  controllers: [LimitsController],
  providers: [LimitsService],
})
export class LimitsModule {}
