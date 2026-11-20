import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { insertMenu, insertMerchant, insertUser } from '../../test/fixtures.js';
import { RECENT_ORDERS, type RecentOrdersReader } from './recent-orders.js';
import { RecommendModule } from './recommend.module.js';
import { RecommendService } from './recommend.service.js';

const NOW = Date.parse('2026-12-10T12:28:00+09:00');
const DAY = 86_400_000;
const handles: DbHandle[] = [];
afterEach(() => {
  while (handles.length) handles.pop()?.close();
});

async function setup(recent: RecentOrdersReader, env: Record<string, string> = {}) {
  const h = openDb(':memory:');
  runMigrations(h.db);
  handles.push(h);
  insertUser(h.db, 'u1', { myPeriodicWon: 300_000n, perOrderWon: 10_000n });
  insertUser(h.db, 'u3', { myPeriodicWon: 300_000n, perOrderWon: 50_000n });
  insertUser(h.db, 'uf', { frozen: true });
  insertMerchant(h.db, 'm-gukbap', { name: '마루국밥', category: '한식', tags: ['국물'] });
  insertMerchant(h.db, 'm-bunsik', { name: '대청분식', category: '분식' });
  insertMerchant(h.db, 'm-bossam', { name: '한상보쌈', category: '한식', tags: ['고기'] });
  insertMerchant(h.db, 'm-fake', { name: '초특가 아무거나', category: '기타', verified: false });
  insertMerchant(h.db, 'm-off', { name: '쉬는 가게', active: false });
  insertMenu(h.db, 'x-dwaeji', 'm-gukbap', 9_000n, { name: '돼지국밥', tags: ['국물'] });
  insertMenu(h.db, 'x-gimbap', 'm-bunsik', 3_500n, { name: '김밥' });
  insertMenu(h.db, 'x-bossam-l', 'm-bossam', 45_000n, { name: '보쌈 대(大)' });
  insertMenu(h.db, 'x-anything', 'm-fake', 1_000n, { name: '무엇이든', tags: ['국물'] });
  insertMenu(h.db, 'x-off', 'm-off', 1_000n, { name: '쉬는 국밥', tags: ['국물'] });
  const moduleRef = await Test.createTestingModule({ imports: [RecommendModule] })
    .useMocker((t) => (t === DB ? h : t === APP_CONFIG ? loadConfig(env) : undefined))
    .overrideProvider(RECENT_ORDERS)
    .useValue(recent)
    .compile();
  return moduleRef.get(RecommendService);
}

const none: RecentOrdersReader = { since: () => [] };

describe('RecommendService', () => {
  it('never recommends unverified or inactive merchants, however cheap', async () => {
    const svc = await setup(none);
    const r = await svc.recommend('u1', {}, NOW);
    const ids = r.items.map((x) => x.merchant.id);
    expect(ids).not.toContain('m-fake');
    expect(ids).not.toContain('m-off');
    // 1,000원 국물 menus at hidden merchants would otherwise top the list.
    expect(r.items.map((x) => x.menu.id)).toEqual(['x-dwaeji', 'x-gimbap']);
    expect(r.weather).toBe('비');
  });

  it('uses the session user per-order limit: 45,000 needs approval at 10,000, not at 50,000', async () => {
    const svc = await setup(none);
    const l1 = await svc.recommend('u1', { craving: '보쌈' }, NOW);
    expect(l1.items.map((x) => [x.menu.id, x.approvalReason])).toEqual([
      ['x-bossam-l', 'OVER_LEVEL_LIMIT'],
    ]);
    const l3 = await svc.recommend('u3', { craving: '보쌈' }, NOW);
    expect(l3.items.map((x) => [x.menu.id, x.approvalReason])).toEqual([['x-bossam-l', null]]);
  });

  it('takes maxPrice in aokrw', async () => {
    const svc = await setup(none);
    const r = await svc.recommend('u1', { maxPriceAokrw: okrwToAokrw(5_000n) }, NOW);
    expect(r.items.map((x) => x.menu.id)).toEqual(['x-gimbap']);
  });

  it('asks the recent-orders port for 30 days and maps categories through MerchantsService', async () => {
    const asked: { userId: string; sinceMs: number }[] = [];
    const svc = await setup({
      since: (userId, sinceMs) => {
        asked.push({ userId, sinceMs });
        return [{ merchantId: 'm-gukbap', createdAtMs: NOW - DAY }];
      },
    });
    const r = await svc.recommend('u1', {}, NOW);
    expect(asked).toEqual([{ userId: 'u1', sinceMs: NOW - 30 * DAY }]);
    const gukbap = r.items.find((x) => x.menu.id === 'x-dwaeji');
    // 한식 is the only category in history (100), but 국밥 was yesterday (novelty 0).
    expect(gukbap?.fits).toMatchObject({ habit: 100, novelty: 0 });
  });

  it('recommends nothing for a frozen dragon', async () => {
    const svc = await setup(none);
    const r = await svc.recommend('uf', {}, NOW);
    expect(r).toMatchObject({ items: [], frozen: true });
  });

  it('refuses a weather provider that is not wired instead of making weather up', async () => {
    const svc = await setup(none, { WEATHER_PROVIDER: 'openmeteo' });
    await expect(svc.recommend('u1', {}, NOW)).rejects.toMatchObject({ code: 'INTERNAL' });
  });
});
