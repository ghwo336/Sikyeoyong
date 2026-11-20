import { aokrwToString, okrwToAokrw } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { type DbHandle, openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import {
  agents,
  allowedMerchants,
  approvals,
  merchants,
  orders,
  users,
} from '../../db/schema/index.js';
import { ApprovalsRepository } from './approvals.repository.js';
import { APPROVAL_TTL_MS, ApprovalsService, approvalReasonOf } from './approvals.service.js';

const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

const won = (n: bigint) => aokrwToString(okrwToAokrw(n));
const NOW = Date.parse('2026-12-01T03:00:00.000Z');

function setup() {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  h.db
    .insert(users)
    .values({ id: 'u1', nickname: '주인님', monthlyBudgetAokrw: won(300_000n), createdAt: 1 })
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
  for (const id of ['m1', 'm2']) {
    h.db
      .insert(merchants)
      .values({
        id,
        name: id,
        category: 'korean',
        payoutAddress: `pay-${id}`,
        metadataUri: `https://x.test/${id}`,
        source: 'seed',
        createdAt: 1,
      })
      .run();
  }
  const insertOrder = (id: string, status: 'quoted' | 'pending_approval') =>
    h.db
      .insert(orders)
      .values({
        id,
        orderRef: `0x${id.padStart(64, '0')}`,
        userId: 'u1',
        agentId: 'a1',
        merchantId: 'm1',
        amountAokrw: won(45_000n),
        itemsJson: '[]',
        status,
        createdAt: 1,
        updatedAt: 1,
      })
      .run();
  return { h, s: new ApprovalsService(new ApprovalsRepository(h)), insertOrder };
}

describe('ApprovalsService.openWithOrder (D-19: no pending order without its approval)', () => {
  it('writes the order and a pending approval that expires in 10 minutes', () => {
    const { h, s, insertOrder } = setup();
    const r = s.openWithOrder(
      {
        userId: 'u1',
        agentId: 'a1',
        orderId: '01',
        reason: 'OVER_LEVEL_LIMIT',
        payload: { amount: won(45_000n) },
      },
      () => insertOrder('01', 'pending_approval'),
      NOW,
    );
    expect(r.expiresAt).toBe(NOW + 600_000);
    expect(APPROVAL_TTL_MS).toBe(600_000);
    expect(
      h.db
        .select()
        .from(orders)
        .all()
        .map((o) => o.status),
    ).toEqual(['pending_approval']);
    const rows = h.db.select().from(approvals).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: r.approvalId,
      userId: 'u1',
      agentId: 'a1',
      orderId: '01',
      reason: 'OVER_LEVEL_LIMIT',
      status: 'pending',
      expiresAt: NOW + 600_000,
      payloadJson: JSON.stringify({ amount: '45000000000000000000000' }),
    });
  });

  it('writes nothing when writing the order fails', () => {
    const { h, s } = setup();
    expect(() =>
      s.openWithOrder(
        { userId: 'u1', agentId: 'a1', orderId: '01', reason: 'NEW_MERCHANT' },
        () => {
          throw new Error('order lost the race');
        },
        NOW,
      ),
    ).toThrow('order lost the race');
    expect(h.db.select().from(approvals).all()).toHaveLength(0);
  });

  it('refuses an async writeOrder (its writes would land outside the transaction)', () => {
    const { h, s } = setup();
    expect(() =>
      s.openWithOrder(
        { userId: 'u1', agentId: 'a1', orderId: '01', reason: 'NEW_MERCHANT' },
        async () => {},
        NOW,
      ),
    ).toThrow(expect.objectContaining({ code: 'INTERNAL' }));
    expect(h.db.select().from(approvals).all()).toHaveLength(0);
  });

  it('rolls the order back when the approval cannot be written (second pending one)', () => {
    const { h, s, insertOrder } = setup();
    insertOrder('01', 'quoted');
    const open = () =>
      s.openWithOrder(
        { userId: 'u1', agentId: 'a1', orderId: '01', reason: 'OVER_PERSONAL_BUDGET' },
        () =>
          h.db.update(orders).set({ status: 'pending_approval' }).where(eq(orders.id, '01')).run(),
        NOW,
      );
    open();
    h.db.update(orders).set({ status: 'quoted' }).where(eq(orders.id, '01')).run();
    expect(open).toThrow(); // approvals_pending_order_uq
    expect(h.db.select().from(orders).get()?.status).toBe('quoted');
    expect(h.db.select().from(approvals).all()).toHaveLength(1);
  });
});

describe('ApprovalsService helpers', () => {
  it('maps only the approval refusals to reasons', () => {
    expect(approvalReasonOf('SERVER_OVER_LEVEL')).toBe('OVER_LEVEL_LIMIT');
    expect(approvalReasonOf('CHAIN_AGENT_LIMIT')).toBe('OVER_LEVEL_LIMIT');
    expect(approvalReasonOf('SERVER_NEW_MERCHANT')).toBe('NEW_MERCHANT');
    expect(approvalReasonOf('SERVER_BUDGET_OVER')).toBe('OVER_PERSONAL_BUDGET');
    for (const code of [
      'CHAIN_PERIODIC_LIMIT',
      'CHAIN_INSUFFICIENT_FUNDS',
      'SERVER_FROZEN',
      'SERVER_PRICE_CHANGED',
      'INTERNAL',
    ] as const) {
      expect(approvalReasonOf(code)).toBeNull();
    }
  });

  it('knows a store only after the owner allowed it, per user', () => {
    const { h, s } = setup();
    expect(s.isMerchantAllowed('u1', 'm1')).toBe(false);
    h.db.insert(allowedMerchants).values({ userId: 'u1', merchantId: 'm1', approvedAt: 1 }).run();
    expect(s.isMerchantAllowed('u1', 'm1')).toBe(true);
    expect(s.isMerchantAllowed('u1', 'm2')).toBe(false);
    expect(s.isMerchantAllowed('u2', 'm1')).toBe(false);
  });
});

describe('ApprovalsService.decide (the decision and its effect in one transaction)', () => {
  const open = (
    s: ApprovalsService,
    insertOrder: (id: string, st: 'quoted' | 'pending_approval') => unknown,
  ) =>
    s.openWithOrder(
      { userId: 'u1', agentId: 'a1', orderId: '01', reason: 'NEW_MERCHANT' },
      () => insertOrder('01', 'pending_approval'),
      NOW,
    );

  it('decides once: a second decision on the same row writes nothing and says false', () => {
    const { h, s, insertOrder } = setup();
    const { approvalId } = open(s, insertOrder);
    const row = h.db.select().from(approvals).where(eq(approvals.id, approvalId)).get();
    if (row === undefined) throw new Error('no row');
    expect(s.decide(row, 'approved', () => undefined, NOW, { allowMerchant: 'm1' })).toBe(true);
    expect(s.decide(row, 'rejected', () => undefined, NOW)).toBe(false);
    expect(h.db.select().from(approvals).get()).toMatchObject({
      status: 'approved',
      decidedAt: NOW,
    });
    expect(s.isMerchantAllowed('u1', 'm1')).toBe(true);
  });

  it('if the effect throws, the decision and the allowance are rolled back', () => {
    const { h, s, insertOrder } = setup();
    const { approvalId } = open(s, insertOrder);
    const row = h.db.select().from(approvals).where(eq(approvals.id, approvalId)).get();
    if (row === undefined) throw new Error('no row');
    expect(() =>
      s.decide(
        row,
        'approved',
        () => {
          throw new Error('order moved');
        },
        NOW,
        { allowMerchant: 'm1' },
      ),
    ).toThrow('order moved');
    expect(h.db.select().from(approvals).get()?.status).toBe('pending');
    expect(s.isMerchantAllowed('u1', 'm1')).toBe(false);
  });

  it('refuses an async effect (its writes would land outside the transaction)', () => {
    const { h, s, insertOrder } = setup();
    const { approvalId } = open(s, insertOrder);
    const row = h.db.select().from(approvals).where(eq(approvals.id, approvalId)).get();
    if (row === undefined) throw new Error('no row');
    expect(() => s.decide(row, 'approved', async () => {}, NOW, { allowMerchant: 'm1' })).toThrow(
      expect.objectContaining({ code: 'INTERNAL' }),
    );
    expect(h.db.select().from(approvals).get()?.status).toBe('pending');
    expect(s.isMerchantAllowed('u1', 'm1')).toBe(false);
  });
});

describe('ApprovalsService.attachMessage (request_owner_approval)', () => {
  it('adds the message and keeps the amount and store the approval was opened with', () => {
    const { h, s, insertOrder } = setup();
    const amount = won(45_000n);
    s.openWithOrder(
      {
        userId: 'u1',
        agentId: 'a1',
        orderId: '01',
        reason: 'OVER_PERSONAL_BUDGET',
        payload: { merchantId: 'm1', amount },
      },
      () => insertOrder('01', 'pending_approval'),
      NOW,
    );
    expect(s.attachMessage('01', '이번만 부탁해용', NOW)).toBe('OVER_PERSONAL_BUDGET');
    expect(JSON.parse(h.db.select().from(approvals).get()?.payloadJson ?? '{}')).toEqual({
      merchantId: 'm1',
      amount: '45000000000000000000000',
      message: '이번만 부탁해용',
    });
    // Approved after the message: the budget allowance still matches this amount.
    h.db.update(approvals).set({ status: 'approved' }).run();
    expect(s.budgetApprovedFor('01', amount)).toBe(true);
  });

  it('caps a message at 200 characters even if a caller passes more', () => {
    const { h, s, insertOrder } = setup();
    s.openWithOrder(
      { userId: 'u1', agentId: 'a1', orderId: '01', reason: 'NEW_MERCHANT' },
      () => insertOrder('01', 'pending_approval'),
      NOW,
    );
    s.attachMessage('01', '가'.repeat(201), NOW);
    const p = JSON.parse(h.db.select().from(approvals).get()?.payloadJson ?? '{}') as {
      message: string;
    };
    expect(p.message).toHaveLength(200);
  });

  it('answers null for an expired or a missing approval and writes nothing', () => {
    const { h, s, insertOrder } = setup();
    s.openWithOrder(
      { userId: 'u1', agentId: 'a1', orderId: '01', reason: 'NEW_MERCHANT' },
      () => insertOrder('01', 'pending_approval'),
      NOW,
    );
    expect(s.attachMessage('01', '늦음', NOW + 600_000)).toBeNull();
    expect(s.attachMessage('02', '없음', NOW)).toBeNull();
    expect(h.db.select().from(approvals).get()?.payloadJson).toBe('{}');
  });
});
