import { Inject, Injectable } from '@nestjs/common';
import { AppError, aokrwToString, parseAokrw, type UserView } from '@sikyeoyong/shared';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';
import { UsersRepository } from './users.repository.js';

/** The user's own settings. Other modules read users only through this service. */
@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * dev-login only: the user for a local developer key, made on first use with the
   * policy's default monthly budget. Ids are `dev-<key>`, never an OAuth user's.
   */
  ensureDevUser(key: string, nowMs: number = Date.now()): string {
    const id = `dev-${key}`;
    this.repo.ensure({
      id,
      nickname: key,
      monthlyBudgetAokrw: aokrwToString(this.config.policy.defaultMonthlyBudgetAokrw),
      createdAt: nowMs,
    });
    return id;
  }

  /** Personal monthly budget in aokrw (server-side only, D-07). */
  /** The name the ID card shows for the owner (users.nickname). */
  getNickname(userId: string): string {
    const profile = this.repo.findProfile(userId);
    if (profile === undefined) throw new AppError('NOT_FOUND', { reason: 'user not found' });
    return profile.nickname;
  }

  getMonthlyBudgetAokrw(userId: string): bigint {
    const stored = this.repo.findMonthlyBudget(userId);
    if (stored === undefined) throw new AppError('NOT_FOUND', { reason: 'user not found' });
    return parseAokrw(stored);
  }

  /**
   * Where an order goes, as the confirm card says it ("회사(역삼동)"): the address
   * text, else the neighborhood, else '집' until the user sets one (user-flow 7).
   * Blank text counts as not set.
   */
  getDestination(userId: string): string {
    const a = this.repo.findAddress(userId);
    if (a === undefined) throw new AppError('NOT_FOUND', { reason: 'user not found' });
    const text = a.text?.trim() ?? '';
    const dong = a.dong?.trim() ?? '';
    return text !== '' ? text : dong !== '' ? dong : '집';
  }

  /** The neighborhood of the default address (get_context), null when not set. */
  getAddressDong(userId: string): string | null {
    const dong = this.repo.findAddressDong(userId);
    if (dong === undefined) throw new AppError('NOT_FOUND', { reason: 'user not found' });
    return dong;
  }

  /**
   * PATCH /me monthly budget (D-21): only one of the policy options, applied at
   * once (the budget is an in-app limit, not a chain one). Any other amount is 400.
   */
  setMonthlyBudget(userId: string, aokrw: bigint): UserView {
    const allowed = this.config.policy.monthlyBudgetOptions.some((o) => o.amountAokrw === aokrw);
    if (!allowed) {
      throw new AppError('VALIDATION_FAILED', {
        public: {
          issues: [{ path: 'monthlyBudgetOkrw', message: 'not one of the budget options' }],
        },
      });
    }
    if (this.repo.findProfile(userId) === undefined)
      throw new AppError('NOT_FOUND', { reason: 'user not found' });
    this.repo.setMonthlyBudget(userId, aokrwToString(aokrw));
    return this.view(userId);
  }

  private view(userId: string): UserView {
    const profile = this.repo.findProfile(userId);
    if (profile === undefined) throw new AppError('NOT_FOUND', { reason: 'user not found' });
    return { user: { nickname: profile.nickname, monthlyBudget: profile.monthlyBudgetAokrw } };
  }
}
