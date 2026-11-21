import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type DbHandle, openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { orders } from '../../db/schema/index.js';
import { fakeReceipts, insertMerchant, insertUser } from '../../test/fixtures.js';
import { type OrderRow, OrdersRepository } from './orders.repository.js';

const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
  vi.restoreAllMocks();
});

const tx = (c: string) => `0x${c.repeat(32)}`;

function setup(builderFails = false) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  insertUser(h.db, 'u1');
  insertMerchant(h.db, 'm1');
  h.db
    .insert(orders)
    .values({
      id: 'o1',
      orderRef: `0x${'1'.padStart(64, '0')}`,
      userId: 'u1',
      agentId: 'a-u1',
      merchantId: 'm1',
      amountAokrw: '1',
      itemsJson: '[]',
      status: 'submitting',
      createdAt: 1,
      updatedAt: 1,
    })
    .run();
  const repo = new OrdersRepository(h);
  const receipts = fakeReceipts(repo, 'B');
  if (builderFails) {
    const agents = {
      onchainAgentIdOf: () => {
        throw new Error('agent lookup down');
      },
    };
    Object.assign(receipts, { agents });
  }
  const row = () => repo.findForUser('o1', 'u1') as OrderRow;
  return { receipts, row };
}

describe('OrderReceipts.markPaid', () => {
  it('moves to paid and writes the receipt in the same update', () => {
    const { receipts, row } = setup();
    expect(receipts.markPaid(row(), 'submitting', tx('ab'), 5)).toBe(true);
    expect(row()).toMatchObject({ status: 'paid', txHash: tx('ab') });
    expect(row().receiptJson).not.toBeNull();
  });

  it('a second call loses and does not overwrite the receipt or the hash', () => {
    const { receipts, row } = setup();
    const first = row();
    expect(receipts.markPaid(first, 'submitting', tx('ab'), 5)).toBe(true);
    const written = row().receiptJson;
    expect(receipts.markPaid(first, 'submitting', tx('cd'), 6)).toBe(false);
    expect(row().receiptJson).toBe(written);
    expect(row().txHash).toBe(tx('ab'));
  });

  it('a receipt that cannot be built still pays the order, receipt stays null, and warns', () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { receipts, row } = setup(true);
    expect(receipts.markPaid(row(), 'submitting', tx('ab'), 5)).toBe(true);
    expect(row()).toMatchObject({ status: 'paid', txHash: tx('ab'), receiptJson: null });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('o1');
    expect(String(warn.mock.calls[0]?.[0])).not.toContain(tx('ab'));
  });
});
