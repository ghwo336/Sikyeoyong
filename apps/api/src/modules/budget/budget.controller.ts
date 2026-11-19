import { Controller, Get, UseGuards } from '@nestjs/common';
import type { BudgetView } from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import type { SessionUser } from '../auth/auth.service.js';
import { BudgetService } from './budget.service.js';

/** GET /api/budget (tech-spec 3.2). HTTP only: the user comes from the session. */
@Controller('budget')
@UseGuards(SessionGuard)
export class BudgetController {
  constructor(private readonly budget: BudgetService) {}

  @Get()
  get(@CurrentUser() user: SessionUser): Promise<BudgetView> {
    return this.budget.getView(user.userId);
  }
}
