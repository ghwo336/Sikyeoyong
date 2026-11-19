import { Injectable } from '@nestjs/common';
import { AppError, parseAokrw } from '@sikyeoyong/shared';
import { UsersRepository } from './users.repository.js';

/** The user's own settings. Other modules read users only through this service. */
@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  /** Personal monthly budget in aokrw (server-side only, D-07). */
  getMonthlyBudgetAokrw(userId: string): bigint {
    const stored = this.repo.findMonthlyBudget(userId);
    if (stored === undefined) throw new AppError('NOT_FOUND', { reason: 'user not found' });
    return parseAokrw(stored);
  }
}
