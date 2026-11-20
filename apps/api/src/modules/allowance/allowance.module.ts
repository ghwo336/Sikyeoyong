import { Module } from '@nestjs/common';
import { AllowanceRepository } from './allowance.repository.js';
import { AllowanceService } from './allowance.service.js';

/** The owner allowance ledger (D-24 custodial). No routes: wallet, signup and orders use it. */
@Module({
  providers: [AllowanceRepository, AllowanceService],
  exports: [AllowanceService],
})
export class AllowanceModule {}
