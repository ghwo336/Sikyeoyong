import { okrwToAokrw } from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { type DbHandle, openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { menus, merchants } from '../../db/schema/index.js';
import { insertMenu, insertMerchant } from '../../test/fixtures.js';
import { DbMerchantSource, MOCK_ETA_MIN } from './db-merchant-source.js';
import { MerchantsRepository } from './merchants.repository.js';

const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

function setup() {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  insertMerchant(h.db, 'm2', { category: '중식', tags: ['면'] });
  insertMerchant(h.db, 'm1', { name: '마루국밥', tags: ['국물'], verified: false });
  insertMenu(h.db, 'b', 'm1', 9_500n, { tags: ['국물'], description: '진한 국물' });
  insertMenu(h.db, 'a', 'm1', 9_000n);
  insertMenu(h.db, 'c', 'm2', 7_000n);
  return { h, source: new DbMerchantSource(new MerchantsRepository(h)) };
}

describe('MerchantsRepository and DbMerchantSource', () => {
  it('reads rows in id order, filters by category, prices as bigint', () => {
    const { source } = setup();
    expect(source.list({}).map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(source.list({ category: '중식' }).map((m) => m.id)).toEqual(['m2']);
    expect(source.get('m1')).toEqual({
      id: 'm1',
      onchainId: null,
      source: 'seed',
      name: '마루국밥',
      category: '한식',
      tags: ['국물'],
      verified: false,
      active: true,
      openHours: { 'mon-sun': '00:00-24:00' },
      etaMin: MOCK_ETA_MIN,
    });
    expect(source.get('zz')).toBeNull();
    expect(source.menus('m1')).toEqual([
      {
        id: 'a',
        merchantId: 'm1',
        name: 'a',
        priceAokrw: okrwToAokrw(9_000n),
        tags: [],
        description: '',
        available: true,
      },
      {
        id: 'b',
        merchantId: 'm1',
        name: 'b',
        priceAokrw: okrwToAokrw(9_500n),
        tags: ['국물'],
        description: '진한 국물',
        available: true,
      },
    ]);
  });

  it('reads a broken JSON column as empty: no tags, never open', () => {
    const { h, source } = setup();
    h.db
      .update(merchants)
      .set({ tagsJson: '{oops', openHoursJson: '["x"]' })
      .where(eq(merchants.id, 'm2'))
      .run();
    h.db.update(menus).set({ tagsJson: 'null' }).where(eq(menus.id, 'c')).run();
    expect(source.get('m2')).toMatchObject({ tags: [], openHours: {} });
    expect(source.menus('m2')[0]?.tags).toEqual([]);
  });
});
