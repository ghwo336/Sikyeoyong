import { Module } from '@nestjs/common';
import { ApprovalsRepository } from './approvals.repository.js';
import { ApprovalsService } from './approvals.service.js';

@Module({
  providers: [ApprovalsRepository, ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
