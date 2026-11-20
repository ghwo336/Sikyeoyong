import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DevLoginController } from './dev-login.controller.js';
import { DevLoginGuard } from './dev-login.guard.js';
import { MeController, SignupController } from './me.controller.js';
import { MeService } from './me.service.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule, AgentsModule],
  controllers: [MeController, SignupController, DevLoginController],
  providers: [UsersRepository, UsersService, MeService, DevLoginGuard],
  exports: [UsersService],
})
export class UsersModule {}
