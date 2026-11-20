import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { IdentityController } from './identity.controller.js';
import { IdentityRepository } from './identity.repository.js';
import { IdentityService } from './identity.service.js';

/** The owner's identity check (D-16). */
@Module({
  imports: [AuthModule],
  controllers: [IdentityController],
  providers: [IdentityRepository, IdentityService],
  exports: [IdentityService],
})
export class IdentityModule {}
