import { Injectable, Logger } from '@nestjs/common';
import {
  AppError,
  type ChatHistory,
  type ChatHistoryMessage,
  zChatEvent,
} from '@sikyeoyong/shared';
import { z } from 'zod';
import { ChatRepository, type ChatRow } from './chat.repository.js';

/** Rows per page of GET /chat/history (a screenful and a bit). */
export const HISTORY_PAGE_ROWS = 30;

const zUser = z.object({ text: z.string() });
const zDragon = z.object({ events: z.array(zChatEvent) });

function parse<T>(schema: z.ZodType<T>, json: string): T | null {
  try {
    const r = schema.safeParse(JSON.parse(json));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** The session id as the API shows it; left out for rows from before sessions. */
function sessionOf(row: ChatRow): { sessionId?: string } {
  return row.sessionId === null ? {} : { sessionId: row.sessionId };
}

/**
 * GET /chat/history (tech-spec 3.2): the session user's own messages, oldest
 * first within a page, paging toward older ones. A dragon turn comes back as
 * the events it was made of. Rows this version cannot read are left out (and
 * logged) rather than failing the whole page.
 */
@Injectable()
export class ChatHistoryService {
  private readonly logger = new Logger(ChatHistoryService.name);

  constructor(private readonly repo: ChatRepository) {}

  page(userId: string, cursor: string | undefined, nowMs: number = Date.now()): ChatHistory {
    let before: ChatRow | null = null;
    if (cursor !== undefined) {
      const row = this.repo.findOwn(userId, cursor);
      // Another user's id looks the same as no id at all.
      if (row === undefined)
        throw new AppError('VALIDATION_FAILED', {
          public: { issues: [{ path: 'cursor', message: 'unknown cursor' }] },
        });
      before = row;
    }
    const rows = this.repo.olderThan(userId, before, HISTORY_PAGE_ROWS + 1);
    const hasMore = rows.length > HISTORY_PAGE_ROWS;
    const pageRows = rows.slice(0, HISTORY_PAGE_ROWS).reverse();
    const messages: ChatHistoryMessage[] = [];
    for (const row of pageRows) {
      const message = this.toMessage(row);
      if (message === null) this.logger.warn(`left out an unreadable chat row ${row.id}`);
      else messages.push(message);
    }
    const oldest = pageRows[0];
    // The stamp is the time of the first message actually shown (unreadable rows are left out).
    const firstShown = pageRows.find((r) => messages.some((m) => m.id === r.id));
    return {
      startedAt: firstShown?.createdAt ?? nowMs,
      messages,
      nextCursor: hasMore && oldest !== undefined ? oldest.id : null,
    };
  }

  private toMessage(row: ChatRow): ChatHistoryMessage | null {
    if (row.role === 'user') {
      const user = parse(zUser, row.contentJson);
      return user === null
        ? null
        : {
            id: row.id,
            role: 'user',
            text: user.text,
            createdAt: row.createdAt,
            ...sessionOf(row),
          };
    }
    const dragon = parse(zDragon, row.contentJson);
    return dragon === null
      ? null
      : {
          id: row.id,
          role: 'dragon',
          events: dragon.events,
          createdAt: row.createdAt,
          ...sessionOf(row),
        };
  }
}
