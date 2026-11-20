import { describe, expect, it } from 'vitest';
import { deliveryStatus, toOrderView } from './order-view.js';
import { loadConfig } from '../../config/env.js';
import type { MerchantsService } from '../merchants/merchants.service.js';
import type { UsersService } from '../users/users.service.js';
import { OrderViews } from './order-views.service.js';
import type { OrderRow, OrdersRepository } from './orders.repository.js';

// A 3-minute delivery from t=0: 15% is 27 s, 45% is 81 s, 100% is 180 s.
const at = (ms: number) => deliveryStatus('paid', 0, 3, ms);

describe('deliveryStatus (simulated stages until the delivery module)', () => {
  it('paid, then preparing, delivering and delivered at 15%, 45% and 100% of the way', () => {
    expect(at(0)).toBe('paid');
    expect(at(26_999)).toBe('paid');
    expect(at(27_000)).toBe('preparing');
    expect(at(80_999)).toBe('preparing');
    expect(at(81_000)).toBe('delivering');
    expect(at(179_999)).toBe('delivering');
    expect(at(180_000)).toBe('delivered');
  });

  it('touches only paid orders', () => {
    for (const s of ['quoted', 'pending_approval', 'submitting', 'failed', 'cancelled'] as const) {
      expect(deliveryStatus(s, 0, 3, 10 * 60_000)).toBe(s);
    }
  });

  it('an unknown eta (0) still finishes, after a minute', () => {
    expect(deliveryStatus('paid', 0, 0, 59_999)).toBe('delivering');
    expect(deliveryStatus('paid', 0, 0, 60_000)).toBe('delivered');
  });
});

describe('toOrderView with and without the simulation', () => {
  const row = {
    id: 'o1',
    status: 'paid',
    amountAokrw: '1',
    itemsJson: '[]',
    note: null,
    errorCode: null,
    txHash: null,
    submitStartedAt: 0,
    createdAt: 0,
  } as unknown as OrderRow;
  const ctx = { store: '가게', destination: '집', etaMin: 3 };

  it('a real delivery path shows the stored status (no made-up progress)', () => {
    expect(toOrderView(row, ctx, 10 * 60_000).status).toBe('paid');
  });

  it('the simulation moves the screen and its dragon line', () => {
    const v = toOrderView(row, { ...ctx, simulateDelivery: true }, 10 * 60_000);
    expect(v).toMatchObject({ status: 'delivered', dragonMood: 'eating' });
  });
});

describe('OrderViews turns the simulation on only on the mock chain or in the demo', () => {
  const row = {
    id: 'o1',
    status: 'paid',
    amountAokrw: '1',
    itemsJson: '[]',
    note: null,
    errorCode: null,
    txHash: null,
    submitStartedAt: 0,
    createdAt: 0,
  } as unknown as OrderRow;
  const views = (env: Record<string, string>) =>
    new OrderViews(
      { findForUser: () => row } as unknown as OrdersRepository,
      { orderInfoOf: () => ({ name: '가게', etaMin: 3 }) } as unknown as MerchantsService,
      { getDestination: () => '집' } as unknown as UsersService,
      loadConfig(env),
    );
  const later = 10 * 60_000; // long past the 3-minute eta

  it('path B without the demo shows the stored status, never a made-up arrival', () => {
    const v = views({ PAYMENT_PATH: 'B', DEMO_MODE: 'false' }).viewFor('u1', 'o1', later);
    expect(v.status).toBe('paid');
  });

  it('path B in the demo plays the stages out', () => {
    const v = views({ PAYMENT_PATH: 'B', DEMO_MODE: 'true' }).viewFor('u1', 'o1', later);
    expect(v.status).toBe('delivered');
  });

  it('the mock chain plays the stages out', () => {
    const v = views({ PAYMENT_PATH: 'mock', DEMO_MODE: 'false' }).viewFor('u1', 'o1', later);
    expect(v.status).toBe('delivered');
  });
});
