import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { SessionGuard } from '../../common/guards/session.guard.js';
import { SessionsRepository } from './sessions.repository.js';

/** Sessions now; OAuth (Kakao, Google) joins with its secrets (auth.md). */
@Module({
  providers: [SessionsRepository, AuthService, SessionGuard],
  exports: [AuthService, SessionGuard],
})
export class AuthModule {}
