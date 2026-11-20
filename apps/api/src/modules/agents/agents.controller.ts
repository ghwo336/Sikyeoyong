import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { type AgentSetupView, type CreateAgentBody, zCreateAgentBody } from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { SessionUser } from '../auth/auth.service.js';
import { AgentsService } from './agents.service.js';

/** POST /api/agents, GET /api/agents/me, POST /api/agents/me/setup/retry. HTTP only. */
@Controller('agents')
@UseGuards(SessionGuard)
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Post()
  create(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(zCreateAgentBody)) body: CreateAgentBody,
  ): { agent: { id: string; status: 'PENDING' } } {
    return this.agents.create(user.userId, body);
  }

  @Get('me')
  me(@CurrentUser() user: SessionUser): AgentSetupView {
    return this.agents.setupView(user.userId);
  }

  @Post('me/setup/retry')
  @HttpCode(200)
  retry(@CurrentUser() user: SessionUser): AgentSetupView {
    return this.agents.retrySetup(user.userId);
  }
}
