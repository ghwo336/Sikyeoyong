import { Module } from '@nestjs/common';
import { AgentsRepository } from './agents.repository.js';
import { AgentsService } from './agents.service.js';

@Module({
  providers: [AgentsRepository, AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
