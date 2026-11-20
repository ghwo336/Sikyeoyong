import { okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import type { MenuRecord, MerchantRecord, MerchantSource } from './merchant-source.js';
import { clipText, MerchantsService } from './merchants.service.js';

const NOW = Date.parse('2026-12-10T12:28:00+09:00');
const ALL_DAY = { 'mon-sun': '00:00-24:00' };

function merchant(id: string, patch: Partial<MerchantRecord> = {}): MerchantRecord {
  return {
    id,
    onchainId: null,
    name: id,
    category: '한식',
    tags: [],
    verified: true,
    active: true,
    openHours: ALL_DAY,
    etaMin: 3,
    ...patch,
  };
}

function menu(id: string, merchantId: string, won: bigint, patch: Partial<MenuRecord> = {}) {
  return {
    id,
    merchantId,
    name: id,
    priceAokrw: okrwToAokrw(won),
    tags: [],
    description: '',
    available: true,
    ...patch,
  } satisfies MenuRecord;
}

/** In-memory MerchantSource: the service is tested without a database. */
function source(ms: MerchantRecord[], menus: MenuRecord[]): MerchantSource {
  return {
    list: (f) => ms.filter((m) => f.category === undefined || m.category === f.category),
    get: (id) => ms.find((m) => m.id === id) ?? null,
    menus: (id) => menus.filter((x) => x.merchantId === id),
  };
}

const MERCHANTS = [
  merchant('m-ok', { name: '마루국밥', tags: ['국물'] }),
  merchant('m-fake', { verified: false }),
  merchant('m-off', { active: false }),
  merchant('m-closed', { openHours: { 'mon-sun': '00:00-01:00' }, category: '중식' }),
];
const MENUS = [
  menu('x1', 'm-ok', 9_000n, { tags: ['국물'] }),
  menu('x2', 'm-ok', 15_000n, { available: false }),
  menu('y1', 'm-fake', 1_000n),
  menu('z1', 'm-closed', 7_000n),
];
const svc = () => new MerchantsService(source(MERCHANTS, MENUS));

describe('MerchantsService', () => {
  it('lists only verified and active merchants, closed ones marked', () => {
    expect(svc().list({}, NOW)).toEqual([
      {
        id: 'm-ok',
        name: '마루국밥',
        category: '한식',
        tags: ['국물'],
        verified: true,
        openNow: true,
        etaMin: 3,
      },
      {
        id: 'm-closed',
        name: 'm-closed',
        category: '중식',
        tags: [],
        verified: true,
        openNow: false,
        etaMin: 3,
      },
    ]);
    expect(
      svc()
        .list({ category: '중식' }, NOW)
        .map((m) => m.id),
    ).toEqual(['m-closed']);
  });

  it('gives menus with aokrw strings and treats hidden merchants as not found', () => {
    const d = svc().detail('m-ok', NOW);
    expect(d.menus).toEqual([
      {
        id: 'x1',
        name: 'x1',
        price: '9000000000000000000000',
        tags: ['국물'],
        description: '',
        available: true,
      },
      {
        id: 'x2',
        name: 'x2',
        price: '15000000000000000000000',
        tags: [],
        description: '',
        available: false,
      },
    ]);
    for (const id of ['m-fake', 'm-off', 'nope']) {
      expect(() => svc().detail(id, NOW)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
    }
  });

  it('clips merchant-written text to the tech-spec 9.2 caps', () => {
    const long = new MerchantsService(
      source(
        [
          merchant('m', {
            name: '가'.repeat(60),
            tags: ['  ', 't'.repeat(30), ...Array.from({ length: 12 }, (_, i) => `k${String(i)}`)],
          }),
        ],
        [menu('x', 'm', 1_000n, { name: '나'.repeat(50), description: '설'.repeat(300) })],
      ),
    ).detail('m', NOW);
    expect(long.merchant.name).toBe('가'.repeat(40));
    expect(long.merchant.tags).toHaveLength(10);
    expect(long.merchant.tags[0]).toBe('t'.repeat(20));
    expect(long.menus[0]?.name).toBe('나'.repeat(40));
    expect(long.menus[0]?.description).toBe('설'.repeat(200));
  });

  it('never splits a character when clipping', () => {
    expect(clipText('ab😀', 3)).toBe('ab');
    expect(clipText('ab😀', 4)).toBe('ab😀');
  });

  it('catalog holds visible merchants with bigint prices', () => {
    const c = svc().catalog(NOW);
    expect(c.map((e) => e.merchant.id)).toEqual(['m-ok', 'm-closed']);
    expect(c[0]?.menus[0]?.priceAokrw).toBe(okrwToAokrw(9_000n));
  });

  it('lookupForOrder says why a merchant cannot take an order', () => {
    const s = svc();
    expect(s.lookupForOrder('nope', NOW)).toEqual({ status: 'unknown' });
    expect(s.lookupForOrder('m-fake', NOW)).toEqual({
      status: 'not_orderable',
      reason: 'unverified',
    });
    expect(s.lookupForOrder('m-off', NOW)).toEqual({
      status: 'not_orderable',
      reason: 'inactive',
    });
    expect(s.lookupForOrder('m-closed', NOW)).toEqual({
      status: 'not_orderable',
      reason: 'closed',
    });
    const ok = s.lookupForOrder('m-ok', NOW);
    if (ok.status !== 'ok') throw new Error('expected ok');
    expect(ok.menus.get('x1')?.priceAokrw).toBe(okrwToAokrw(9_000n));
    expect(ok.menus.get('x2')?.available).toBe(false);
    expect(ok.menus.has('y1')).toBe(false);
  });

  it('categoryOf reads hidden merchants too', () => {
    expect(svc().categoryOf('m-fake')).toBe('한식');
    expect(svc().categoryOf('nope')).toBeNull();
  });
});
