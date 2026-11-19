import { aokrwToString, okrwToAokrw, parseAokrw } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { type DbHandle, openDb } from '../client.js';
import { enumCheck, intEnumCheck } from './checks.js';
import { runMigrations } from '../migrate.js';
import {
  agentLimitHistory,
  agents,
  allowedMerchants,
  approvals,
  chatMessages,
  merchants,
  nagEvents,
  oauthAccounts,
  orderEvents,
  orders,
  sessions,
  users,
} from './index.js';

// tech-spec 4, data.md: amounts as aokrw text with CHECKs, unix ms, one agent per user,
// one pending approval per order, idempotent chain events.

const handles: DbHandle[] = [];
function fresh(): DbHandle {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  return h;
}
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

const won = (n: bigint) => aokrwToString(okrwToAokrw(n));

function seed(h: DbHandle) {
  h.db
    .insert(users)
    .values({ id: 'u1', nickname: '호재', monthlyBudgetAokrw: won(300_000n), createdAt: 1 })
    .run();
  h.db
    .insert(agents)
    .values({
      id: 'a1',
      userId: 'u1',
      dragonName: '용이',
      dragonSpecies: 'forest',
      paymentPath: 'B',
      createdAt: 1,
    })
    .run();
  h.db
    .insert(merchants)
    .values({
      id: 'm1',
      name: '마루국밥',
      category: 'korean',
      payoutAddress: '0x1',
      metadataUri: 'https://x.test/m1',
      source: 'seed',
      createdAt: 1,
    })
    .run();
  h.db
    .insert(orders)
    .values({
      id: 'o1',
      orderRef: `0x${'1'.repeat(64)}`,
      userId: 'u1',
      agentId: 'a1',
      merchantId: 'm1',
      amountAokrw: won(9_000n),
      itemsJson: '[]',
      status: 'quoted',
      createdAt: 1,
      updatedAt: 1,
    })
    .run();
}

const CORE_TABLES = [
  'users',
  'oauth_accounts',
  'sessions',
  'agents',
  'agent_limit_history',
  'orders',
  'order_events',
  'approvals',
  'allowed_merchants',
  'chat_messages',
  'nag_events',
];

const BAD_AMOUNTS = ['', '-1', '1.5', '0100', '00', '1e3', ' 1', '1 ', '0x10', '9'.repeat(79)];

/** Every amount column in migration 0001 (data.md: amounts carry a CHECK in the DB too). */
const AMOUNT_COLUMNS = [
  ['orders', 'amount'],
  ['users', 'monthly_budget'],
  ['nag_events', 'spent'],
  ['nag_events', 'budget'],
  ['agent_limit_history', 'transfer_limit'],
] as const;

/** Every enum column in migration 0001, with a value outside the list. */
const ENUM_COLUMNS = [
  ['users', 'role', 'admin'],
  ['oauth_accounts', 'provider', 'naver'],
  ['sessions', 'platform', 'desktop'],
  ['agents', 'dragon_species', 'fire'],
  ['agents', 'status', 'LOST'],
  ['agents', 'payment_path', 'D'],
  ['agents', 'level', 4],
  ['agent_limit_history', 'level', 0],
  ['orders', 'status', 'done'],
  ['order_events', 'source', 'llm'],
  ['approvals', 'reason', 'BECAUSE'],
  ['approvals', 'status', 'maybe'],
  ['chat_messages', 'role', 'system'],
  ['nag_events', 'level', 'warn50'],
] as const;

/** Raw update of one seeded row; names come from the constant lists above only. */
function setColumn(h: DbHandle, table: string, column: string, value: string | number) {
  h.sqlite.prepare(`update "${table}" set "${column}" = ?`).run(value);
}

/** seed() plus one valid row in every other core table. */
function seedAll(h: DbHandle) {
  seed(h);
  h.db
    .insert(oauthAccounts)
    .values({ id: 'oa1', userId: 'u1', provider: 'kakao', providerUserId: 'k1', createdAt: 1 })
    .run();
  h.db.insert(sessions).values({ id: 's1', userId: 'u1', platform: 'web', expiresAt: 1 }).run();
  h.db
    .insert(agentLimitHistory)
    .values({ id: 'l1', agentId: 'a1', level: 1, transferLimitAokrw: won(10_000n), createdAt: 1 })
    .run();
  h.db
    .insert(orderEvents)
    .values({
      id: 'e1',
      orderId: 'o1',
      type: 'OrderPlaced',
      source: 'chain',
      txHash: '0xabc',
      logIndex: 0,
      createdAt: 1,
    })
    .run();
  h.db
    .insert(approvals)
    .values({
      id: 'ap1',
      userId: 'u1',
      agentId: 'a1',
      orderId: 'o1',
      reason: 'NEW_MERCHANT',
      expiresAt: 10,
    })
    .run();
  h.db
    .insert(chatMessages)
    .values({ id: 'c1', userId: 'u1', role: 'user', contentJson: '{}', createdAt: 1 })
    .run();
  h.db
    .insert(nagEvents)
    .values({
      id: 'n1',
      userId: 'u1',
      monthKst: '2026-12',
      level: 'warn70',
      spentAokrw: won(210_000n),
      budgetAokrw: won(300_000n),
      createdAt: 1,
    })
    .run();
}

describe('core domain schema (migration 0001)', () => {
  it('creates every table on an empty DB', () => {
    const h = fresh();
    const names = h.sqlite
      .prepare("select name from sqlite_master where type = 'table'")
      .all()
      .map((r) => (r as { name: string }).name);
    for (const t of [
      'users',
      'oauth_accounts',
      'sessions',
      'agents',
      'agent_limit_history',
      'orders',
      'order_events',
      'approvals',
      'allowed_merchants',
      'chat_messages',
      'nag_events',
    ]) {
      expect(names, t).toContain(t);
    }
  });

  it('round-trips amounts above 10^24 aokrw without loss', () => {
    const h = fresh();
    seed(h);
    const big = okrwToAokrw(123_456_789_012_345_678n);
    h.db
      .update(orders)
      .set({ amountAokrw: aokrwToString(big) })
      .where(eq(orders.id, 'o1'))
      .run();
    const row = h.db.select().from(orders).where(eq(orders.id, 'o1')).get();
    expect(parseAokrw(row?.amountAokrw ?? '')).toBe(big);
  });

  it.each(AMOUNT_COLUMNS)('rejects bad aokrw text in %s.%s', (table, column) => {
    const h = fresh();
    seedAll(h);
    for (const bad of BAD_AMOUNTS) {
      expect(() => {
        setColumn(h, table, column, bad);
      }, JSON.stringify(bad)).toThrow(/CHECK/);
    }
  });

  it.each(AMOUNT_COLUMNS)('accepts 0 and 78 digits in %s.%s', (table, column) => {
    const h = fresh();
    seedAll(h);
    for (const ok of ['0', '9'.repeat(78)]) {
      expect(() => {
        setColumn(h, table, column, ok);
      }).not.toThrow();
    }
  });

  it.each(ENUM_COLUMNS)('rejects an unknown value in %s.%s', (table, column, bad) => {
    const h = fresh();
    seedAll(h);
    expect(() => {
      setColumn(h, table, column, bad);
    }).toThrow(/CHECK/);
  });

  // Every CHECK in migration 0001 must be exercised above, so dropping one fails a test.
  it('tests every CHECK constraint migration 0001 creates', () => {
    const h = fresh();
    const ddl = h.sqlite
      .prepare(
        "select sql from sqlite_master where type = 'table' and name in (" +
          CORE_TABLES.map(() => '?').join(', ') +
          ')',
      )
      .all(...CORE_TABLES) as { sql: string }[];
    const declared = ddl
      .flatMap((r) => [...r.sql.matchAll(/CONSTRAINT "([a-z_]+_check)"/g)].map((m) => m[1]))
      .sort();
    const tested = [...AMOUNT_COLUMNS, ...ENUM_COLUMNS.map(([t, c]) => [t, c] as const)]
      .map(([t, c]) => `${t}_${c}_check`)
      .sort();
    expect(declared).toEqual(tested);
  });

  it('allows one agent per user and one order per orderRef', () => {
    const h = fresh();
    seed(h);
    expect(() =>
      h.db
        .insert(agents)
        .values({
          id: 'a2',
          userId: 'u1',
          dragonName: '둘째',
          dragonSpecies: 'star',
          paymentPath: 'B',
          createdAt: 2,
        })
        .run(),
    ).toThrow(/UNIQUE/);
    expect(() =>
      h.db
        .insert(orders)
        .values({
          id: 'o2',
          orderRef: `0x${'1'.repeat(64)}`,
          userId: 'u1',
          agentId: 'a1',
          merchantId: 'm1',
          amountAokrw: '1',
          itemsJson: '[]',
          status: 'quoted',
          createdAt: 2,
          updatedAt: 2,
        })
        .run(),
    ).toThrow(/UNIQUE/);
  });

  it('allows one pending approval per order, any number decided (D-19)', () => {
    const h = fresh();
    seed(h);
    const base = {
      userId: 'u1',
      agentId: 'a1',
      orderId: 'o1',
      reason: 'NEW_MERCHANT' as const,
      expiresAt: 10,
    };
    h.db
      .insert(approvals)
      .values({ id: 'ap1', ...base })
      .run();
    expect(() =>
      h.db
        .insert(approvals)
        .values({ id: 'ap2', ...base })
        .run(),
    ).toThrow(/UNIQUE/);
    h.db
      .update(approvals)
      .set({ status: 'rejected', decidedAt: 5 })
      .where(eq(approvals.id, 'ap1'))
      .run();
    h.db
      .insert(approvals)
      .values({ id: 'ap3', ...base })
      .run();
    expect(h.db.select().from(approvals).all()).toHaveLength(2);
  });

  it('keeps chain events idempotent on (tx_hash, log_index)', () => {
    const h = fresh();
    seed(h);
    const ev = {
      orderId: 'o1',
      type: 'OrderPlaced',
      source: 'chain' as const,
      txHash: '0xabc',
      logIndex: 0,
      createdAt: 1,
    };
    h.db
      .insert(orderEvents)
      .values({ id: 'e1', ...ev })
      .run();
    expect(() =>
      h.db
        .insert(orderEvents)
        .values({ id: 'e2', ...ev })
        .run(),
    ).toThrow(/UNIQUE/);
  });

  it('enforces foreign keys and unique oauth identities', () => {
    const h = fresh();
    seed(h);
    expect(() =>
      h.db
        .insert(sessions)
        .values({ id: 'hash', userId: 'nobody', platform: 'web', expiresAt: 1 })
        .run(),
    ).toThrow(/FOREIGN KEY/);
    const acct = { userId: 'u1', provider: 'kakao' as const, providerUserId: 'k-1', createdAt: 1 };
    h.db
      .insert(oauthAccounts)
      .values({ id: 'oa1', ...acct })
      .run();
    expect(() =>
      h.db
        .insert(oauthAccounts)
        .values({ id: 'oa2', ...acct })
        .run(),
    ).toThrow(/UNIQUE/);
    h.db.insert(allowedMerchants).values({ userId: 'u1', merchantId: 'm1', approvedAt: 1 }).run();
    expect(() =>
      h.db.insert(allowedMerchants).values({ userId: 'u1', merchantId: 'm1', approvedAt: 2 }).run(),
    ).toThrow(/UNIQUE|PRIMARY/);
    expect(() =>
      h.db
        .insert(chatMessages)
        .values({
          id: 'c1',
          userId: 'u1',
          role: 'system' as never,
          contentJson: '{}',
          createdAt: 1,
        })
        .run(),
    ).toThrow(/CHECK/);
  });
});

describe('enumCheck', () => {
  it('refuses values that would not be safe inside DDL', () => {
    expect(() => enumCheck('x', users.role, ["a'); drop table users; --"])).toThrow(/unsafe/);
    expect(() => enumCheck('x', users.role, ['user', 'operator'])).not.toThrow();
    expect(() => enumCheck('x', users.role, [])).toThrow(/no values/);
    expect(() => enumCheck('x" or 1=1 --', users.role, ['user'])).toThrow(/unsafe constraint/);
    expect(() => intEnumCheck('x', agents.level, [1, 1.5])).toThrow(/unsafe value/);
    expect(() => intEnumCheck('x', agents.level, [])).toThrow(/no values/);
  });
});
