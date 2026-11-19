import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { sessions } from '../../db/schema/index.js';

export type SessionPlatform = 'web' | 'native';

/** Queries on sessions only. The id column holds the SHA-256 of the token, never the token. */
@Injectable()
export class SessionsRepository {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  insert(row: { id: string; userId: string; platform: SessionPlatform; expiresAt: number }): void {
    this.handle.db.insert(sessions).values(row).run();
  }

  /** The live session with this hash at nowMs (not revoked, not expired). */
  findLive(idHash: string, nowMs: number) {
    return this.handle.db
      .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(
        and(eq(sessions.id, idHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, nowMs)),
      )
      .get();
  }

  revoke(idHash: string, nowMs: number): void {
    this.handle.db
      .update(sessions)
      .set({ revokedAt: nowMs })
      .where(and(eq(sessions.id, idHash), isNull(sessions.revokedAt)))
      .run();
  }
}
