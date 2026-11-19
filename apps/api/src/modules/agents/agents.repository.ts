import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { agents } from '../../db/schema/index.js';

/** Queries on agents only. */
@Injectable()
export class AgentsRepository {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  findByUserId(userId: string) {
    return this.handle.db
      .select({
        id: agents.id,
        level: agents.level,
        status: agents.status,
        walletAddress: agents.walletAddress,
      })
      .from(agents)
      .where(eq(agents.userId, userId))
      .get();
  }
}
