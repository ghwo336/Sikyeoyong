import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  type AgentSetupView,
  type CreateAgentBody,
  type FreezeResult,
  type PatchAgentBody,
  type PatchAgentResult,
  type RefundResult,
  zCreateAgentBody,
  zMeView,
  zPatchAgentBody,
} from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { SessionUser } from '../auth/auth.service.js';
import { AgentFreezeService } from './agent-freeze.service.js';
import { AgentLookService } from './agent-look.service.js';
import { AgentRefundService } from './agent-refund.service.js';
import { AgentsService } from './agents.service.js';

/**
 * POST /api/agents, GET /api/agents/me, the owner's freeze, unfreeze and drain buttons,
 * POST /api/agents/me/setup/retry and PATCH /api/agents/:id (Look, D-32). HTTP only. PUT /agents/me/limits is the limits module's (D-31).
 */
@Controller('agents')
@UseGuards(SessionGuard)
export class AgentsController {
  constructor(
    private readonly agents: AgentsService,
    private readonly freezes: AgentFreezeService,
    private readonly refunds: AgentRefundService,
    private readonly looks: AgentLookService,
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

  /** Look (user-flow 18): the species only, nothing on chain. The id is MeView.agentId. */
  @Patch(':id')
  @HttpCode(200)
  look(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(zMeView.shape.agentId)) id: string,
    @Body(new ZodValidationPipe(zPatchAgentBody)) body: PatchAgentBody,
  ): PatchAgentResult {
    return this.looks.change(user.userId, id, body);
  }
}
