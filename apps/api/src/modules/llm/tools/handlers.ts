import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  type BudgetView,
  formatKstClock,
  formatKstDate,
  formatOkrw,
  parseAokrw,
} from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../../config/config.module.js';
import type { AppConfig } from '../../../config/env.js';
import { BudgetService } from '../../budget/budget.service.js';
import { UsersService } from '../../users/users.service.js';
import type { SessionContext, ToolHandlers } from '../runtime.js';
import type { ToolName } from './definitions.js';

const won = (aokrw: string) => formatOkrw(parseAokrw(aokrw));
const kstTime = (unixMs: number) => `${formatKstDate(unixMs)} ${formatKstClock(unixMs)}`;

/**
 * What get_budget shows the model: amounts already in the one display format
 * ("300,000원") and the reset time already in KST, so the model never converts
 * units and only repeats numbers the server made (CLAUDE.md rule 4, tech-spec 3.3).
 * The HTTP BudgetView stays in aokrw for the screens.
 */
export function budgetForModel(view: BudgetView) {
  return {
    month: view.monthKst,
    personalBudget: won(view.personalBudget),
    personalSpent: won(view.personalSpent),
    nagLevel: view.nagLevel,
    thirtyDayCap: won(view.chainCap),
    thirtyDayUsed: won(view.chainUsed),
    thirtyDayResetsAt: view.chainResetAtSec === null ? null : kstTime(view.chainResetAtSec * 1000),
    level: view.level,
    perOrderLimit: won(view.perOrderLimit),
    frozen: view.frozen,
    budgetOptions: view.budgetOptions.map((o) => ({ id: o.id, amount: won(o.amount) })),
  };
}

/** Weather the demo uses so scenes replay the same (tech-spec 3.8, WEATHER_PROVIDER=static). */
export const STATIC_WEATHER = '비';

/**
 * The server functions behind the tools. Every handler takes the user from the
 * session context, never from model input. Tools whose modules are not built
 * yet answer with an AppError, which the runtime hands back to the model as an
 * error result, so the dragon says it cannot do that yet instead of guessing.
 */
@Injectable()
export class LlmToolHandlers {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly budget: BudgetService,
    private readonly users: UsersService,
  ) {}

  /** nowMs is a seam for tests. */
  build(now: () => number = Date.now): ToolHandlers {
    const notReady = (tool: ToolName) => () =>
      Promise.reject(new AppError('INTERNAL', { reason: 'tool not ready', tool }));
    return {
      get_budget: (ctx: SessionContext) =>
        this.budget.getView(ctx.userId, now()).then(budgetForModel),
      get_context: (ctx: SessionContext) => Promise.resolve().then(() => this.context(ctx, now())),
      get_order_history: notReady('get_order_history'),
      recommend_merchants: notReady('recommend_merchants'),
      get_menu: notReady('get_menu'),
      place_order: notReady('place_order'),
      request_owner_approval: notReady('request_owner_approval'),
      propose_limit_change: notReady('propose_limit_change'),
    };
  }

  private context(ctx: SessionContext, nowMs: number) {
    if (this.config.llm.weatherProvider !== 'static') {
      throw new AppError('INTERNAL', {
        reason: 'weather provider not wired',
        variables: ['WEATHER_PROVIDER'],
      });
    }
    return {
      // Year included so the model never guesses it; 24-hour clock avoids 오전/오후 slips.
      nowKst: kstTime(nowMs),
      dong: this.users.getAddressDong(ctx.userId),
      weather: STATIC_WEATHER,
    };
  }
}
