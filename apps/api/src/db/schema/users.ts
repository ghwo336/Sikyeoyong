import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { aokrwCheck, enumCheck } from './checks.js';

// tech-spec 4. Money is aokrw decimal text, time is unix ms, ids are UUID v7.
export const USER_ROLES = ['user', 'operator', 'merchant'] as const;

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    nickname: text('nickname').notNull(),
    addressText: text('address_text'),
    addressDong: text('address_dong'),
    /** Personal monthly budget, server-side only (D-07). */
    monthlyBudgetAokrw: text('monthly_budget').notNull(),
    role: text('role', { enum: USER_ROLES }).notNull().default('user'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    aokrwCheck('users_monthly_budget_check', t.monthlyBudgetAokrw),
    enumCheck('users_role_check', t.role, USER_ROLES),
  ],
);

export const OAUTH_PROVIDERS = ['kakao', 'google', 'apple'] as const;

/** No provider tokens are stored here (data.md MUST NOT). */
export const oauthAccounts = sqliteTable(
  'oauth_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    provider: text('provider', { enum: OAUTH_PROVIDERS }).notNull(),
    providerUserId: text('provider_user_id').notNull(),
    email: text('email'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('oauth_accounts_provider_user_uq').on(t.provider, t.providerUserId),
    enumCheck('oauth_accounts_provider_check', t.provider, OAUTH_PROVIDERS),
  ],
);

export const SESSION_PLATFORMS = ['web', 'native'] as const;

/** id is the SHA-256 of the session token; the token itself is never stored (tech-spec 9.4). */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    platform: text('platform', { enum: SESSION_PLATFORMS }).notNull(),
    expiresAt: integer('expires_at').notNull(),
    revokedAt: integer('revoked_at'),
  },
  (t) => [
    index('sessions_user_id_idx').on(t.userId),
    enumCheck('sessions_platform_check', t.platform, SESSION_PLATFORMS),
  ],
);
