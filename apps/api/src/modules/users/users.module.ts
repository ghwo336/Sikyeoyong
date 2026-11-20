import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PouchiModule } from '../pouchi/pouchi.module.js';
import { DevLoginController } from './dev-login.controller.js';
import { DevLoginGuard } from './dev-login.guard.js';
import { MeController, SignupController } from './me.controller.js';
import { MeService } from './me.service.js';
import { PouchiLoginController } from './pouchi-login.controller.js';
import { PouchiLoginService } from './pouchi-login.service.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule, AgentsModule, IdentityModule, PouchiModule],
  controllers: [MeController, SignupController, DevLoginController, PouchiLoginController],
  providers: [UsersRepository, UsersService, MeService, DevLoginGuard, PouchiLoginService],
  exports: [UsersService],
})
export class UsersModule {}
