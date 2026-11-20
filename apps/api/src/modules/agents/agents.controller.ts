import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  type AgentSetupView,
  type CreateAgentBody,
  type SetLevelBody,
  type SetLevelResult,
  zCreateAgentBody,
  zSetLevelBody,
} from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { SessionUser } from '../auth/auth.service.js';
import { AgentLevelService } from './agent-level.service.js';
import { AgentsService } from './agents.service.js';

/** POST /api/agents, GET /api/agents/me, POST /api/agents/me/setup/retry. HTTP only. */
@Controller('agents')
@UseGuards(SessionGuard)
export class AgentsController {
  constructor(
    private readonly agents: AgentsService,
    private readonly levels: AgentLevelService,
  ) {}

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

  /** The owner's level button (D-21, D-28). Raising waits for re-auth unless REAUTH_MODE=none. */
  @Post('me/level')
  @HttpCode(200)
  setLevel(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(zSetLevelBody)) body: SetLevelBody,
  ): Promise<SetLevelResult> {
    return this.levels.setLevel(user.userId, body.level);
  }

  @Post('me/setup/retry')
  @HttpCode(200)
  retry(@CurrentUser() user: SessionUser): AgentSetupView {
    return this.agents.retrySetup(user.userId);
  }
}
