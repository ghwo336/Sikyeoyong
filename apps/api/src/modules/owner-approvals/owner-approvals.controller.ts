import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  type ApprovalDecision,
  type ApprovalList,
  zApprovalIdParam,
  zApprovalListQuery,
} from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import {
  UserRateLimitGuard,
  UserRateLimited,
} from '../../common/rate-limit/user-rate-limit.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import type { SessionUser } from '../auth/auth.service.js';
import { OwnerApprovalsService } from './owner-approvals.service.js';

/** /api/approvals (tech-spec 3.2). HTTP only: the owner is the session user. */
@Controller('approvals')
@UseGuards(SessionGuard, UserRateLimitGuard)
export class OwnerApprovalsController {
  constructor(private readonly owner: OwnerApprovalsService) {}

  @Get()
  list(
    @CurrentUser() user: SessionUser,
    @Query(new ZodValidationPipe(zApprovalListQuery)) _query: unknown,
  ): ApprovalList {
    return this.owner.list(user.userId);
  }

  /** Never pays: the order is quoted again and its card comes back (D-19). */
  @Post(':id/approve')
  @HttpCode(200)
  @UserRateLimited('approval')
  approve(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(zApprovalIdParam)) id: string,
  ): Promise<ApprovalDecision> {
    return this.owner.approve(user.userId, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @UserRateLimited('approval')
  reject(
    @CurrentUser() user: SessionUser,
    @Param('id', new ZodValidationPipe(zApprovalIdParam)) id: string,
  ): Promise<ApprovalDecision> {
    return this.owner.reject(user.userId, id);
  }
}
