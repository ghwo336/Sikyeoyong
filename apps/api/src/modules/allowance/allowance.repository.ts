import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
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
}
