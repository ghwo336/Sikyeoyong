import { Injectable } from '@nestjs/common';
import { aokrwToString } from '@sikyeoyong/shared';
import { uuidv7 } from '../../common/ids.js';
import { AllowanceRepository, ledgerBalance, type AllowanceKind } from './allowance.repository.js';

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
    return ledgerBalance(this.repo.entriesOf(userId));
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

  /**
   * Holds `amountAokrw` of the owner's allowance for a top-up that is about to be sent: the
   * balance check and the fund entry are one transaction. Returns the entry id, or null when
   * the allowance cannot cover it (nothing written). Call settleFund after the money moved or
   * releaseFund when nothing was sent.
   */
  reserveFund(
    userId: string,
    amountAokrw: bigint,
    orderId: string,
    nowMs: number = Date.now(),
  ): string | null {
    if (amountAokrw <= 0n) throw new RangeError('allowance amount must be above zero');
    const id = uuidv7(nowMs);
    const ok = this.repo.insertFundIfCovered({
      id,
      userId,
      kind: 'fund',
      amountAokrw: aokrwToString(amountAokrw),
      txHash: null,
      createdAt: nowMs,
      orderId,
      fundCallStartedAt: null,
    });
    return ok ? id : null;
  }

  /** Gives a reserved amount back (the top-up was never sent). */
  releaseFund(entryId: string): void {
    this.repo.deleteFund(entryId);
  }

  /**
   * Call right before the fund call, after the order's marker is committed. From then on the
   * hold may have moved money and the reconciliation only reports it.
   */
  markFundCallStarted(entryId: string, nowMs: number = Date.now()): void {
    this.repo.markFundCallStarted(entryId, nowMs);
  }

  /** Writes the top-up's transaction hash on a reserved entry. */
  settleFund(entryId: string, txHash: string): void {
    this.repo.setTxHash(entryId, txHash);
  }
}
