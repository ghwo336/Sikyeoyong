import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import type { DbHandle } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { chatMessages } from '../../db/schema/index.js';

export interface ChatRow {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly contentJson: string;
  readonly clientMessageId: string | null;
  readonly replyToId: string | null;
  readonly createdAt: number;
}

/** Queries on chat_messages only. */
@Injectable()
export class ChatRepository {
  constructor(@Inject(DB) private readonly handle: DbHandle) {}

  findUserMessage(userId: string, clientMessageId: string): ChatRow | undefined {
    return this.handle.db
      .select(this.columns())
      .from(chatMessages)
      .where(
        and(eq(chatMessages.userId, userId), eq(chatMessages.clientMessageId, clientMessageId)),
      )
      .get();
  }

  findReply(userRowId: string): ChatRow | undefined {
    return this.handle.db
      .select(this.columns())
      .from(chatMessages)
      .where(eq(chatMessages.replyToId, userRowId))
      .get();
  }

  /** Newest first. */
  recent(userId: string, limit: number): ChatRow[] {
    return this.handle.db
      .select(this.columns())
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(limit)
      .all();
  }

  findOwn(userId: string, id: string): ChatRow | undefined {
    return this.handle.db
      .select(this.columns())
      .from(chatMessages)
      .where(and(eq(chatMessages.userId, userId), eq(chatMessages.id, id)))
      .get();
  }

  /** Newest first, strictly older than `before` (by created_at, then id). */
  olderThan(
    userId: string,
    before: { createdAt: number; id: string } | null,
    limit: number,
  ): ChatRow[] {
    const mine = eq(chatMessages.userId, userId);
    const older =
      before === null
        ? undefined
        : or(
            lt(chatMessages.createdAt, before.createdAt),
            and(eq(chatMessages.createdAt, before.createdAt), lt(chatMessages.id, before.id)),
          );
    return this.handle.db
      .select(this.columns())
      .from(chatMessages)
      .where(older === undefined ? mine : and(mine, older))
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(limit)
      .all();
  }

  /** Throws on a duplicate (user_id, client_message_id): the unique index settles races. */
  insert(row: ChatRow & { readonly userId: string }): void {
    this.handle.db.insert(chatMessages).values(row).run();
  }

  delete(id: string): void {
    this.handle.db.delete(chatMessages).where(eq(chatMessages.id, id)).run();
  }

  private columns() {
    return {
      id: chatMessages.id,
      role: chatMessages.role,
      contentJson: chatMessages.contentJson,
      clientMessageId: chatMessages.clientMessageId,
      replyToId: chatMessages.replyToId,
      createdAt: chatMessages.createdAt,
    };
  }
}
