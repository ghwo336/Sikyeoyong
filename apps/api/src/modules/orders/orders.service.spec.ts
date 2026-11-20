import { okrwToAokrw } from '@sikyeoyong/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { type DbHandle, openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { agents, merchants, orders, users } from '../../db/schema/index.js';
import { type OrderStatus, OrdersRepository } from './orders.repository.js';
import { OrderSpend } from './order-spend.service.js';

const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

// 2026-12 in KST is [2026-11-30T15:00Z, 2026-12-31T15:00Z).
const DEC_START = Date.parse('2026-11-30T15:00:00.000Z');
const JAN_START = Date.parse('2026-12-31T15:00:00.000Z');
const won = (n: bigint) => okrwToAokrw(n).toString();

function setup() {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  for (const id of ['u1', 'u2']) {
    h.db.insert(users).values({ id, nickname: id, monthlyBudgetAokrw: '1', createdAt: 1 }).run();
    h.db
      .insert(agents)
      .values({
        id: `a-${id}`,
        userId: id,
        dragonName: '용이',
        dragonSpecies: 'forest',
        paymentPath: 'B',
        createdAt: 1,
      })
      .run();
  }
  h.db
    .insert(merchants)
    .values({
      id: 'm1',
      name: '국밥',
      category: 'korean',
      payoutAddress: '0x1',
      metadataUri: 'https://x.test',
      source: 'seed',
      createdAt: 1,
    })
    .run();
  let n = 0;
  const add = (userId: string, status: OrderStatus, okrw: bigint, createdAt: number) => {
    n += 1;
    h.db
      .insert(orders)
      .values({
        id: `o${String(n)}`,
        orderRef: `0x${n.toString(16).padStart(64, '0')}`,
        userId,
        agentId: `a-${userId}`,
        merchantId: 'm1',
        amountAokrw: won(okrw),
        itemsJson: '[]',
        status,
        createdAt,
        updatedAt: createdAt,
      })
      .run();
  };
  return { add, s: new OrderSpend(new OrdersRepository(h)) };
}

describe('OrderSpend.spentInMonthAokrw (tech-spec 3.7)', () => {
  it('sums paid and later orders of the user in the KST month, exactly in bigint', () => {
    const { add, s } = setup();
    add('u1', 'paid', 9_000n, DEC_START);
    add('u1', 'preparing', 12_000n, DEC_START + 1);
    add('u1', 'delivering', 7_500n, DEC_START + 2);
    add('u1', 'delivered', 1n, JAN_START - 1);
    expect(s.spentInMonthAokrw('u1', '2026-12')).toBe(okrwToAokrw(28_501n));
  });

  it.each(['quoted', 'pending_approval', 'submitting', 'failed', 'cancelled', 'refunded'] as const)(
    'does not count %s orders',
    (status) => {
      const { add, s } = setup();
      add('u1', status, 9_000n, DEC_START);
      expect(s.spentInMonthAokrw('u1', '2026-12')).toBe(0n);
    },
  );

  it('leaves out other months and other users', () => {
    const { add, s } = setup();
    add('u1', 'paid', 9_000n, DEC_START - 1); // 23:59:59.999 KST Nov 30
    add('u1', 'paid', 9_000n, JAN_START); // 00:00 KST Jan 1
    add('u2', 'paid', 9_000n, DEC_START);
    expect(s.spentInMonthAokrw('u1', '2026-12')).toBe(0n);
    expect(s.spentInMonthAokrw('u2', '2026-12')).toBe(okrwToAokrw(9_000n));
  });

  it('keeps precision past 2^53 aokrw', () => {
    const { add, s } = setup();
    add('u1', 'paid', 123_456_789n, DEC_START);
    add('u1', 'paid', 1n, DEC_START);
    expect(s.spentInMonthAokrw('u1', '2026-12')).toBe(okrwToAokrw(123_456_790n));
  });
});
