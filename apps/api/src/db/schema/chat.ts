import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { aokrwCheck, enumCheck } from './checks.js';
import { users } from './users.js';

export const CHAT_ROLES = ['user', 'assistant'] as const;

/** Chat history; may be deleted on the user's request (data.md). */
export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role', { enum: CHAT_ROLES }).notNull(),
    contentJson: text('content_json').notNull(),
    /** User rows: the client's id for this message, so a resend is answered once (server-api.md). */
    clientMessageId: text('client_message_id'),
    /** Assistant rows: the user row this turn answers. */
    replyToId: text('reply_to_id'),
    /** One meal's conversation (D-34). Null on rows from before sessions; each is its own past. */
    sessionId: text('session_id'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    index('chat_messages_user_created_idx').on(t.userId, t.createdAt),
    index('chat_messages_session_idx').on(t.userId, t.sessionId),
    uniqueIndex('chat_messages_client_id_uq').on(t.userId, t.clientMessageId),
    uniqueIndex('chat_messages_reply_to_uq').on(t.replyToId),
    enumCheck('chat_messages_role_check', t.role, CHAT_ROLES),
  ],
);

export const NAG_LEVELS = ['warn70', 'warn90', 'over100'] as const;

/** One nag per user, KST month and level (tech-spec 3.7). */
export const nagEvents = sqliteTable(
  'nag_events',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    monthKst: text('month_kst').notNull(),
    level: text('level', { enum: NAG_LEVELS }).notNull(),
    spentAokrw: text('spent').notNull(),
    budgetAokrw: text('budget').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('nag_events_user_month_level_uq').on(t.userId, t.monthKst, t.level),
    enumCheck('nag_events_level_check', t.level, NAG_LEVELS),
    aokrwCheck('nag_events_spent_check', t.spentAokrw),
    aokrwCheck('nag_events_budget_check', t.budgetAokrw),
  ],
);
