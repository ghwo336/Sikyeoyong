import { Controller, Get, UseGuards } from '@nestjs/common';
import type { LeakCompareView } from '@sikyeoyong/shared';
import { CurrentUser, SessionGuard } from '../../common/guards/session.guard.js';
import type { SessionUser } from '../auth/auth.service.js';
import { DemoLeakService } from './demo-leak.service.js';

/** GET /api/demo/leak-compare (LeakCompare.dc.html). DEMO_MODE only: 404 otherwise. */
@Controller('demo')
@UseGuards(SessionGuard)
export class DemoController {
  constructor(private readonly leak: DemoLeakService) {}

  @Get('leak-compare')
  leakCompare(@CurrentUser() user: SessionUser): Promise<LeakCompareView> {
    return this.leak.getView(user.userId);
  }
}
