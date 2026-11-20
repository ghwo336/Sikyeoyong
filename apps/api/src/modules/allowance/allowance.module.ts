import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { AllowanceRepository } from './allowance.repository.js';
import { AllowanceService } from './allowance.service.js';
import { TrialController } from './trial.controller.js';

/**
 * The owner allowance ledger (D-24 custodial). One route, the sign-up trial allowance;
 * wallet, orders and refunds record and read through AllowanceService.
 */
@Module({
  imports: [AuthModule, IdentityModule],
  controllers: [TrialController],
  providers: [AllowanceRepository, AllowanceService],
  exports: [AllowanceService],
})
export class AllowanceModule {}
