import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { ALLOWANCE_KINDS, ownerAllowanceEntries } from '../../db/schema/index.js';

export type AllowanceKind = (typeof ALLOWANCE_KINDS)[number];

export interface AllowanceEntry {
  readonly id: string;
  readonly userId: string;
  readonly kind: AllowanceKind;
  readonly amountAokrw: string;
  readonly txHash: string | null;
  readonly createdAt: number;
}

/** trial + refund - fund, in aokrw. */
export function ledgerBalance(entries: readonly AllowanceEntry[]): bigint {
  let total = 0n;
  for (const e of entries) {
    const amount = BigInt(e.amountAokrw);
    total += e.kind === 'fund' ? -amount : amount;
  }
  return total;
}

/** Queries on owner_allowance_entries only. */
@Injectable()
export class AllowanceRepository {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  entriesOf(userId: string): AllowanceEntry[] {
    return this.handle.db
      .select()
      .from(ownerAllowanceEntries)
      .where(eq(ownerAllowanceEntries.userId, userId))
      .all();
  }

  /** Inserts one entry. Returns false when the trial entry already exists (one per user). */
  insert(entry: AllowanceEntry): boolean {
    const result = this.handle.db
      .insert(ownerAllowanceEntries)
      .values(entry)
      .onConflictDoNothing()
      .run();
    return result.changes === 1;
  }

  /**
   * One transaction: the balance is read and the fund entry written together, so two callers
   * cannot both spend the same allowance. Returns false, writing nothing, when the balance is
   * below the entry's amount.
   */
  insertFundIfCovered(entry: AllowanceEntry): boolean {
    return this.handle.db.transaction((tx) => {
      const rows = tx
        .select()
        .from(ownerAllowanceEntries)
        .where(eq(ownerAllowanceEntries.userId, entry.userId))
        .all();
      if (ledgerBalance(rows) < BigInt(entry.amountAokrw)) return false;
      tx.insert(ownerAllowanceEntries).values(entry).run();
      return true;
    });
  }

  /** Takes back a fund entry that was reserved but never sent. */
  deleteFund(id: string): void {
    this.handle.db
      .delete(ownerAllowanceEntries)
      .where(and(eq(ownerAllowanceEntries.id, id), eq(ownerAllowanceEntries.kind, 'fund')))
      .run();
  }

  setTxHash(id: string, txHash: string): void {
    this.handle.db
      .update(ownerAllowanceEntries)
      .set({ txHash })
      .where(eq(ownerAllowanceEntries.id, id))
      .run();
  }
}
