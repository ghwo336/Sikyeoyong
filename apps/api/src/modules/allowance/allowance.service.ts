import { Injectable } from '@nestjs/common';
import { aokrwToString } from '@sikyeoyong/shared';
import { uuidv7 } from '../../common/ids.js';
import { AllowanceRepository, type AllowanceKind } from './allowance.repository.js';

/**
 * The owner's allowance while custodial (D-24): how much of the operator-held money is this
 * user's. In: the sign-up trial allowance and pocket refunds. Out: what was moved into the
 * dragon's pocket. Other modules record and read only through this service.
 */
@Injectable()
export class AllowanceService {
  constructor(private readonly repo: AllowanceRepository) {}

  /** trial + refund - fund, in aokrw. Can be below zero only if a fund was recorded without a check. */
  balanceAokrw(userId: string): bigint {
    let total = 0n;
    for (const e of this.repo.entriesOf(userId)) {
      const amount = BigInt(e.amountAokrw);
      total += e.kind === 'fund' ? -amount : amount;
    }
    return total;
  }

  /**
   * Records one move. amount must be above zero. Returns false only for a second trial
   * (the trial is once per user); the caller decides what that means.
   */
  record(
    userId: string,
    kind: AllowanceKind,
    amountAokrw: bigint,
    txHash: string | null,
    nowMs: number = Date.now(),
  ): boolean {
    if (amountAokrw <= 0n) throw new RangeError('allowance amount must be above zero');
    return this.repo.insert({
      id: uuidv7(nowMs),
      userId,
      kind,
      amountAokrw: aokrwToString(amountAokrw),
      txHash,
      createdAt: nowMs,
    });
  }
}
