import { afterEach, describe, expect, it } from 'vitest';
import { type DbHandle, openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { orders } from '../../db/schema/index.js';
import { insertMerchant, insertUser } from '../../test/fixtures.js';
import { type NewOrder, OrdersRepository } from './orders.repository.js';

const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

function setup() {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  insertUser(h.db, 'u1');
  insertUser(h.db, 'u2');
  insertMerchant(h.db, 'm1');
  return { h, repo: new OrdersRepository(h) };
}

let seq = 0;
const order = (userId: string, clientOrderId: string | null): NewOrder => {
  seq += 1;
  return {
    id: `o${String(seq)}`,
    orderRef: `0x${seq.toString(16).padStart(64, '0')}`,
    userId,
    agentId: `a-${userId}`,
    merchantId: 'm1',
    amountAokrw: '1',
    itemsJson: '[]',
    status: 'quoted',
    clientOrderId,
    note: null,
    createdAt: 1,
  };
};

describe('OrdersRepository.insert (unique user_id + client_order_id, migration 0004)', () => {
  it('refuses the same clientOrderId twice for one user', () => {
    const { h, repo } = setup();
    repo.insert(order('u1', 'c1'));
    expect(() => {
      repo.insert(order('u1', 'c1'));
    }).toThrow();
    expect(h.db.select().from(orders).all()).toHaveLength(1);
  });

  it('lets another user use the same clientOrderId, and many orders have none', () => {
    const { h, repo } = setup();
    repo.insert(order('u1', 'c1'));
    repo.insert(order('u2', 'c1'));
    repo.insert(order('u1', null));
    repo.insert(order('u1', null));
    expect(h.db.select().from(orders).all()).toHaveLength(4);
  });
});
