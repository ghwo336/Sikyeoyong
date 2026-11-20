import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { identityChecks } from '../../db/schema/index.js';

/** Queries on identity_checks only. */
@Injectable()
export class IdentityRepository {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  /** Records a pass once; a second pass keeps the first record. */
  record(userId: string, method: 'kakao' | 'mock', nowMs: number): void {
    this.handle.db
      .insert(identityChecks)
      .values({ userId, method, verifiedAt: nowMs })
      .onConflictDoNothing()
      .run();
  }

  isVerified(userId: string): boolean {
    return (
      this.handle.db
        .select({ userId: identityChecks.userId })
        .from(identityChecks)
        .where(eq(identityChecks.userId, userId))
        .get() !== undefined
    );
  }
}
