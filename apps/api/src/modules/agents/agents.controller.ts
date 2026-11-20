import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  type AgentSetupView,
  type CreateAgentBody,
  type FreezeResult,
  type RefundResult,
  zCreateAgentBody,
} from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { SessionUser } from '../auth/auth.service.js';
import { AgentFreezeService } from './agent-freeze.service.js';
import { AgentRefundService } from './agent-refund.service.js';
import { AgentsService } from './agents.service.js';

/**
 * POST /api/agents, GET /api/agents/me, the owner's freeze, unfreeze and drain buttons, and
 * POST /api/agents/me/setup/retry. HTTP only. PUT /agents/me/limits is the limits module's (D-31).
 */
@Controller('agents')
@UseGuards(SessionGuard)
export class AgentsController {
  constructor(
    private readonly agents: AgentsService,
    private readonly freezes: AgentFreezeService,
    private readonly refunds: AgentRefundService,
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

  /** The kill switch (user-flow 17): the owner's button only, never an LLM tool. */
  @Post('me/freeze')
  @HttpCode(200)
  freeze(@CurrentUser() user: SessionUser): Promise<FreezeResult> {
    return this.freezes.freeze(user.userId);
  }

  @Post('me/unfreeze')
  @HttpCode(200)
  unfreeze(@CurrentUser() user: SessionUser): Promise<FreezeResult> {
    return this.freezes.unfreeze(user.userId);
  }

  /** Frozen screen "돌려받기": the pocket back to the owner, only while frozen. */
  @Post('me/drain')
  @HttpCode(200)
  refund(@CurrentUser() user: SessionUser): Promise<RefundResult> {
    return this.refunds.refund(user.userId);
  }

  @Post('me/setup/retry')
  @HttpCode(200)
  retry(@CurrentUser() user: SessionUser): AgentSetupView {
    return this.agents.retrySetup(user.userId);
  }
}
