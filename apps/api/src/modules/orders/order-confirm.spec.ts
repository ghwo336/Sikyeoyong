import 'reflect-metadata';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AppError,
  type AgentWallet,
  type Hex,
  type OwnerAuthority,
  type PaymentProvider,
  zCreateOrderResult,
  zOrderResult,
} from '@sikyeoyong/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import {
  agents,
  allowedMerchants,
  approvals,
  menus,
  orders,
  users,
} from '../../db/schema/index.js';
import { insertMenu, insertMerchant, insertUser } from '../../test/fixtures.js';
import { AllowanceService } from '../allowance/allowance.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CHAIN_READER } from '../chain/chain.service.js';
import { OWNER_AUTHORITY, PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { OrdersModule } from './orders.module.js';
import { OrdersRepository } from './orders.repository.js';

// Amounts by hand: N won = N * 10^18 aokrw. Default policy: Lv1 10,000 per order.
const W = (won: string) => `${won}000000000000000000`;
const A = (won: string) => BigInt(W(won));
const NOW = Date.parse('2026-12-10T03:00:00.000Z');
const errorOf = (body: unknown) => (body as { error: { code: string } }).error;

const open: { app: INestApplication; h: DbHandle }[] = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const o of open.splice(0)) {
    await o.app.close();
    o.h.close();
  }
});

async function setup(
  opts: { owner?: OwnerAuthority; limitWon?: string; path?: 'mock' | 'C' } = {},
) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  const chainUsed = { value: 0n };
  const h = openDb(':memory:');
  runMigrations(h.db);
  insertUser(h.db, 'u1', { dong: '역삼동' });
  insertUser(h.db, 'u2');
  insertMerchant(h.db, 'm1', { name: '마루국밥' });
  insertMenu(h.db, 'x-dwaeji', 'm1', 9_000n, { name: '돼지국밥' });
  h.db.insert(allowedMerchants).values({ userId: 'u1', merchantId: 'm1', approvedAt: 1 }).run();
  let builder = Test.createTestingModule({ imports: [OrdersModule] })
    .useMocker((t) =>
      t === DB
        ? h
        : t === APP_CONFIG
          ? loadConfig({ PAYMENT_PATH: opts.path ?? 'mock' })
          : undefined,
    )
    .overrideProvider(CHAIN_READER)
    .useValue({
      periodicVolume: () => Promise.resolve({ usedAokrw: chainUsed.value, resetAtSec: null }),
    });
  if (opts.owner !== undefined)
    builder = builder.overrideProvider(OWNER_AUTHORITY).useValue(opts.owner);
  const moduleRef = await builder.compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({ app, h });
  // Hatch u1 on the mock chain: a wallet with its TransferLimit, owned by the operator.
  const payment = moduleRef.get<PaymentProvider>(PAYMENT_PROVIDER);
  const wallet: AgentWallet =
    opts.path === 'C'
      ? {
          agentRowId: 'a-u1',
          address: `0x${'aa'.repeat(20)}`,
          ownerAddress: `0x${'bb'.repeat(20)}`,
        }
      : await payment.createAgent({ userId: 'u1', name: '용이' });
  if (opts.path !== 'C') await payment.setTransferLimit(wallet, A(opts.limitWon ?? '10000'));
  h.db
    .update(agents)
    .set({ walletAddress: wallet.address, ownerAddress: wallet.ownerAddress })
    .where(eq(agents.id, 'a-u1'))
    .run();
  const auth = moduleRef.get(AuthService);
  const tokens = { u1: auth.issue('u1', 'web'), u2: auth.issue('u2', 'web') };
  const http = () => request(app.getHttpServer() as Server);
  const post = (who: 'u1' | 'u2', path: string, body: object = {}) =>
    http()
      .post(path)
      .set('Cookie', `sid=${tokens[who]}`)
      .set('X-Requested-With', 'fetch')
      .send(body);
  const quote = async (clientOrderId = 'c1', qty = 1) =>
    zCreateOrderResult.parse(
      (
        await post('u1', '/api/orders', {
          merchantId: 'm1',
          items: [{ menuId: 'x-dwaeji', qty }],
          clientOrderId,
        })
      ).body,
    ).order.id;
  const confirm = (id: string, who: 'u1' | 'u2' = 'u1') => post(who, `/api/orders/${id}/confirm`);
  const view = (id: string, who: 'u1' | 'u2' = 'u1') =>
    http().get(`/api/orders/${id}`).set('Cookie', `sid=${tokens[who]}`);
  const row = (id: string) => h.db.select().from(orders).where(eq(orders.id, id)).get();
  return {
    h,
    post,
    view,
    payment,
    wallet,
    quote,
    confirm,
    row,
    chainUsed,
    repo: moduleRef.get(OrdersRepository),
    allowance: moduleRef.get(AllowanceService),
  };
}

describe('POST /api/orders/:id/confirm: pays once, only here', () => {
  it('pays a quoted order: tops up exactly the amount, pays it, answers the paid order', async () => {
    const { payment, wallet, quote, confirm, row, allowance } = await setup();
    const fund = vi.spyOn(payment, 'fund');
    const pay = vi.spyOn(payment, 'pay');
    const id = await quote();
    const res = await confirm(id);
    expect(res.status).toBe(200);
    const { order } = zOrderResult.parse(res.body);
    expect(order).toMatchObject({
      id,
      status: 'paid',
      store: '마루국밥',
      destination: '역삼동',
      amount: W('9000'),
      etaAt: NOW + 3 * 60_000,
      remainingMin: 3,
      dragonLine: '주문 넣었어용.\n가게가 받으면 알려 줄게용.',
      dragonMood: 'happy',
    });
    expect(fund).toHaveBeenCalledTimes(1);
    expect(fund.mock.calls[0]?.[1]).toBe(A('9000'));
    expect(pay).toHaveBeenCalledTimes(1);
    expect(pay.mock.calls[0]?.[0]).toMatchObject({
      amount: A('9000'),
      orderRef: row(id)?.orderRef,
    });
    expect(await payment.balanceOf(wallet.address)).toBe(0n);
    const paid = await payment.findPaid(row(id)?.orderRef as Hex);
    expect(row(id)).toMatchObject({
      status: 'paid',
      attempt: 1,
      submitStartedAt: NOW,
      txHash: paid?.txHash,
    });
    expect(order.txHash).toBe(paid?.txHash);
    // The top-up came out of the owner allowance ledger (wallet screen).
    expect(allowance.balanceAokrw('u1')).toBe(-A('9000'));
  });

  it('tops up only the shortfall when the wallet already holds some', async () => {
    const { payment, wallet, quote, confirm, allowance } = await setup();
    await payment.fund(wallet, A('5000'));
    const fund = vi.spyOn(payment, 'fund');
    await confirm(await quote());
    expect(fund.mock.calls.map((c) => c[1])).toEqual([A('4000')]);
    expect(allowance.balanceAokrw('u1')).toBe(-A('4000'));
    expect(await payment.balanceOf(wallet.address)).toBe(0n);
  });

  it('a failed or unneeded top-up takes nothing from the owner allowance ledger', async () => {
    const { payment, wallet, quote, confirm, allowance } = await setup();
    vi.spyOn(payment, 'fund').mockRejectedValueOnce(new Error('rpc down'));
    await confirm(await quote());
    expect(allowance.balanceAokrw('u1')).toBe(0n);
    await payment.fund(wallet, A('9000'));
    const fund = vi.spyOn(payment, 'fund'); // the same spy as above
    fund.mockClear();
    await confirm(await quote());
    expect(fund).not.toHaveBeenCalled();
    expect(allowance.balanceAokrw('u1')).toBe(0n);
  });

  it('a ledger failure after the top-up does not fail the payment', async () => {
    const { allowance, quote, confirm, row } = await setup();
    vi.spyOn(allowance, 'record').mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    const id = await quote();
    expect((await confirm(id)).status).toBe(200);
    expect(row(id)?.status).toBe('paid');
  });

  it('pays once however often or however fast the button is pressed', async () => {
    const { payment, quote, confirm, row } = await setup();
    const pay = vi.spyOn(payment, 'pay');
    const id = await quote();
    const answers = await Promise.all([confirm(id), confirm(id), confirm(id)]);
    expect(answers.map((r) => r.status)).toEqual([200, 200, 200]);
    const again = zOrderResult.parse((await confirm(id)).body);
    expect(again.order.status).toBe('paid');
    expect(pay).toHaveBeenCalledTimes(1);
    expect(row(id)?.attempt).toBe(1);
  });

  it('a request that read the order before another won it does not pay (the conditional UPDATE decides)', async () => {
    const { payment, quote, confirm, repo } = await setup();
    const pay = vi.spyOn(payment, 'pay');
    const fund = vi.spyOn(payment, 'fund');
    const preflight = vi.spyOn(payment, 'preflight');
    const id = await quote();
    const stale = repo.findForUser(id, 'u1');
    await confirm(id);
    // A second request read the order as quoted just before the first one moved it.
    vi.spyOn(repo, 'findForUser').mockReturnValueOnce(stale);
    const late = zOrderResult.parse((await confirm(id)).body);
    expect(late.order.status).toBe('paid');
    expect(pay).toHaveBeenCalledTimes(1);
    expect(fund).toHaveBeenCalledTimes(1); // the loser does not even top up
    expect(preflight).toHaveBeenCalledTimes(1);
  });

  it('is 404 for an unknown order and for another user order', async () => {
    const { quote, confirm } = await setup();
    const id = await quote();
    expect(errorOf((await confirm('nope')).body).code).toBe('NOT_FOUND');
    expect((await confirm(id, 'u2')).status).toBe(404);
  });

  it('does not pay a pending_approval order', async () => {
    const { payment, quote, confirm, row } = await setup();
    const pay = vi.spyOn(payment, 'pay');
    const id = await quote('c1', 2); // 18,000 over the per-order limit
    const res = zOrderResult.parse((await confirm(id)).body);
    expect(res.order).toMatchObject({ status: 'pending_approval', dragonMood: 'worried' });
    expect(pay).not.toHaveBeenCalled();
    expect(row(id)?.attempt).toBe(0);
  });
});

describe('confirm: failures (payment.md "실패 분류")', () => {
  it('a changed price fails for good (SERVER_PRICE_CHANGED), nothing paid, a new press pays nothing', async () => {
    const { h, payment, quote, confirm, row } = await setup();
    const pay = vi.spyOn(payment, 'pay');
    const fund = vi.spyOn(payment, 'fund');
    const id = await quote();
    h.db
      .update(menus)
      .set({ priceAokrw: W('9500') })
      .where(eq(menus.id, 'x-dwaeji'))
      .run();
    const res = zOrderResult.parse((await confirm(id)).body);
    expect(res.order).toMatchObject({ status: 'failed', errorCode: 'SERVER_PRICE_CHANGED' });
    await confirm(id);
    expect(pay).not.toHaveBeenCalled();
    expect(fund).not.toHaveBeenCalled();
    expect(row(id)).toMatchObject({ status: 'failed', attempt: 1, submitStartedAt: null });
  });

  it('frozen after the quote fails retryably; after waking, a press pays the same orderRef', async () => {
    const { h, payment, quote, confirm, row } = await setup();
    const pay = vi.spyOn(payment, 'pay');
    const id = await quote();
    const ref = row(id)?.orderRef;
    h.db.update(agents).set({ status: 'FROZEN' }).where(eq(agents.id, 'a-u1')).run();
    expect(zOrderResult.parse((await confirm(id)).body).order).toMatchObject({
      status: 'failed',
      errorCode: 'SERVER_FROZEN',
    });
    expect(pay).not.toHaveBeenCalled();
    h.db.update(agents).set({ status: 'ACTIVE' }).where(eq(agents.id, 'a-u1')).run();
    expect(zOrderResult.parse((await confirm(id)).body).order.status).toBe('paid');
    expect(pay).toHaveBeenCalledTimes(1);
    expect(pay.mock.calls[0]?.[0].orderRef).toBe(ref);
    expect(row(id)).toMatchObject({ attempt: 2, orderRef: ref });
  });

  it('a retry asks the chain first: already paid there means paid here, no second payment', async () => {
    const { h, payment, quote, confirm, row } = await setup();
    const id = await quote();
    h.db
      .update(orders)
      .set({ status: 'failed', errorCode: 'CHAIN_INSUFFICIENT_FUNDS' })
      .where(eq(orders.id, id))
      .run();
    const tx: Hex = `0x${'cd'.repeat(32)}`;
    vi.spyOn(payment, 'findPaid').mockResolvedValueOnce({ txHash: tx, blockNumber: 7n });
    const pay = vi.spyOn(payment, 'pay');
    const res = zOrderResult.parse((await confirm(id)).body);
    expect(res.order).toMatchObject({ status: 'paid', txHash: tx });
    expect(pay).not.toHaveBeenCalled();
    expect(row(id)).toMatchObject({ status: 'paid', txHash: tx, errorCode: null });
  });

  it('a chain refusal at preflight that asks the owner goes to pending_approval with its approval row', async () => {
    const { h, payment, quote, confirm, row } = await setup({ limitWon: '5000' });
    const pay = vi.spyOn(payment, 'pay');
    const id = await quote(); // 9,000 is within the server's per-order limit (10,000), over the chain's 5,000
    const res = zOrderResult.parse((await confirm(id)).body);
    expect(res.order.status).toBe('pending_approval');
    expect(pay).not.toHaveBeenCalled();
    const ap = h.db.select().from(approvals).all();
    expect(ap.map((a) => [a.orderId, a.reason, a.status])).toEqual([
      [id, 'OVER_LEVEL_LIMIT', 'pending'],
    ]);
    expect(row(id)?.submitStartedAt).toBeNull();
  });

  it('a throw after the marker is an unknown result: stays submitting, a new press pays nothing', async () => {
    const { payment, quote, confirm, row } = await setup();
    const pay = vi.spyOn(payment, 'pay').mockRejectedValueOnce(new Error('socket hang up'));
    const id = await quote();
    const res = zOrderResult.parse((await confirm(id)).body);
    expect(res.order.status).toBe('submitting');
    expect(row(id)).toMatchObject({ status: 'submitting', submitStartedAt: NOW });
    await confirm(id);
    expect(pay).toHaveBeenCalledTimes(1);
  });

  it.each(['CHAIN_MERCHANT_INACTIVE', 'CHAIN_AGENT_PAUSED'] as const)(
    'a %s thrown (not returned) after the marker stays submitting: it may be out already',
    async (code) => {
      const { payment, quote, confirm, row } = await setup();
      const pay = vi.spyOn(payment, 'pay').mockRejectedValueOnce(new AppError(code));
      const id = await quote();
      expect(zOrderResult.parse((await confirm(id)).body).order.status).toBe('submitting');
      expect(row(id)).toMatchObject({
        status: 'submitting',
        errorCode: null,
        submitStartedAt: NOW,
      });
      await confirm(id);
      expect(pay).toHaveBeenCalledTimes(1);
    },
  );

  it('the 30-day cap is checked again at the press: over it fails retryably with no top-up or payment', async () => {
    const { h, payment, quote, confirm, chainUsed } = await setup();
    // The owner's limit is the chain cap, so the server leaves the 30-day check to the chain (D-31).
    h.db
      .update(users)
      .set({ myPeriodicLimitAokrw: W('500000') })
      .where(eq(users.id, 'u1'))
      .run();
    const fund = vi.spyOn(payment, 'fund');
    const pay = vi.spyOn(payment, 'pay');
    const id = await quote();
    chainUsed.value = A('491001'); // other orders since the quote: 491,001 + 9,000 > 500,000
    expect(zOrderResult.parse((await confirm(id)).body).order).toMatchObject({
      status: 'failed',
      errorCode: 'CHAIN_PERIODIC_LIMIT',
    });
    expect(fund).not.toHaveBeenCalled();
    expect(pay).not.toHaveBeenCalled();
    chainUsed.value = A('491000'); // exactly the cap with this order
    expect(zOrderResult.parse((await confirm(id)).body).order.status).toBe('paid');
  });

  it('if the move to pending_approval loses, no approval row is left behind (one transaction)', async () => {
    const { h, quote, confirm, row, repo } = await setup({ limitWon: '5000' });
    const real = repo.transition.bind(repo);
    vi.spyOn(repo, 'transition').mockImplementation((id, from, set, nowMs, opts) =>
      from === 'submitting' && set.status === 'pending_approval'
        ? false
        : real(id, from, set, nowMs, opts),
    );
    const id = await quote();
    await confirm(id);
    expect(h.db.select().from(approvals).all()).toHaveLength(0);
    expect(row(id)?.status).not.toBe('pending_approval');
  });

  it('an INTERNAL answer after the marker also stays submitting (never a new quote)', async () => {
    const { payment, quote, confirm, row } = await setup();
    vi.spyOn(payment, 'pay').mockResolvedValueOnce({
      ok: false,
      stage: 'execution',
      error: { code: 'INTERNAL' },
    });
    const id = await quote();
    await confirm(id);
    expect(row(id)?.status).toBe('submitting');
  });

  it('a retryable chain refusal after the marker fails retryably', async () => {
    const { payment, quote, confirm } = await setup();
    vi.spyOn(payment, 'pay').mockResolvedValueOnce({
      ok: false,
      stage: 'execution',
      error: { code: 'CHAIN_AGENT_PAUSED' },
    });
    const id = await quote();
    const res = zOrderResult.parse((await confirm(id)).body);
    expect(res.order).toMatchObject({ status: 'failed', errorCode: 'CHAIN_AGENT_PAUSED' });
    expect(zOrderResult.parse((await confirm(id)).body).order.status).toBe('paid');
  });

  it('a top-up waiting for the owner signature pays nothing and fails retryably before the marker', async () => {
    const owner: OwnerAuthority = {
      mode: 'pouch',
      prepare: (action) => Promise.resolve({ id: 'p1', action, signer: 'user' }),
      confirm: () => Promise.reject(new Error('must not confirm')),
    };
    const { payment, quote, confirm, row } = await setup({ owner });
    const pay = vi.spyOn(payment, 'pay');
    const id = await quote();
    const res = zOrderResult.parse((await confirm(id)).body);
    expect(res.order).toMatchObject({ status: 'failed', errorCode: 'INTERNAL' });
    expect(pay).not.toHaveBeenCalled();
    expect(row(id)?.submitStartedAt).toBeNull();
  });
});

describe('confirm: the owner 30-day limit and the owner approval', () => {
  it('re-checks the owner 30-day limit at the press (chain window); an approval for exactly this amount lets it pay', async () => {
    const { h, payment, quote, confirm, row, chainUsed } = await setup();
    const pay = vi.spyOn(payment, 'pay');
    const id = await quote();
    // Spent elsewhere after the quote, in the chain's 30-day window: 292,000 + 9,000 > 300,000.
    chainUsed.value = A('292000'); // the chain window after the quote
    expect(zOrderResult.parse((await confirm(id)).body).order.status).toBe('pending_approval');
    expect(h.db.select().from(approvals).get()?.reason).toBe('OVER_PERSONAL_BUDGET');
    // The owner approves (the approvals API's job, done by hand here) and the order is quoted again.
    h.db.update(approvals).set({ status: 'approved', decidedAt: NOW }).run();
    h.db.update(orders).set({ status: 'quoted' }).where(eq(orders.id, id)).run();
    expect(zOrderResult.parse((await confirm(id)).body).order.status).toBe('paid');
    expect(pay).toHaveBeenCalledTimes(1);
    expect(row(id)?.attempt).toBe(2);
  });

  it('an approval for another amount does not count', async () => {
    const { h, quote, confirm, chainUsed } = await setup();
    const id = await quote();
    chainUsed.value = A('292000'); // the chain window after the quote
    h.db
      .insert(approvals)
      .values({
        id: 'ap0',
        userId: 'u1',
        agentId: 'a-u1',
        orderId: id,
        reason: 'OVER_PERSONAL_BUDGET',
        payloadJson: JSON.stringify({ merchantId: 'm1', amount: W('8000') }),
        status: 'approved',
        expiresAt: NOW,
      })
      .run();
    expect(zOrderResult.parse((await confirm(id)).body).order.status).toBe('pending_approval');
  });

  it('path C never pays a failed order again (no proven orderRef guard yet, Q-24)', async () => {
    const { h, payment, quote, confirm, row } = await setup({ path: 'C' });
    const id = await quote();
    h.db
      .update(orders)
      .set({ status: 'failed', errorCode: 'CHAIN_INSUFFICIENT_FUNDS' })
      .where(eq(orders.id, id))
      .run();
    const findPaid = vi.spyOn(payment, 'findPaid');
    const pay = vi.spyOn(payment, 'pay');
    const res = zOrderResult.parse((await confirm(id)).body);
    expect(res.order).toMatchObject({ status: 'failed', errorCode: 'CHAIN_INSUFFICIENT_FUNDS' });
    expect(findPaid).not.toHaveBeenCalled();
    expect(pay).not.toHaveBeenCalled();
    expect(row(id)?.attempt).toBe(0);
  });
});

describe('GET /api/orders/:id (status screens)', () => {
  it('reads a quoted order, then the paid one counting down to arrival', async () => {
    const { quote, confirm, view } = await setup();
    const id = await quote();
    expect(zOrderResult.parse((await view(id)).body).order).toMatchObject({
      status: 'quoted',
      dragonLine: '이대로 괜찮아용?',
      dragonMood: 'default',
      etaAt: NOW + 3 * 60_000,
    });
    await confirm(id);
    // The mock chain plays delivery out by time (3 minutes here): two thirds in, the rider is out.
    vi.setSystemTime(NOW + 2 * 60_000 + 1);
    expect(zOrderResult.parse((await view(id)).body).order).toMatchObject({
      status: 'delivering',
      remainingMin: 1,
      etaAt: NOW + 3 * 60_000,
    });
    vi.setSystemTime(NOW + 10 * 60_000);
    expect(zOrderResult.parse((await view(id)).body).order).toMatchObject({
      status: 'delivered',
      remainingMin: 0,
      dragonMood: 'eating',
    });
  });

  it('a failed order speaks its error line; a line that needs a value falls back to the message', async () => {
    const { h, quote, view } = await setup();
    const id = await quote();
    h.db
      .update(orders)
      .set({ status: 'failed', errorCode: 'SERVER_PRICE_CHANGED' })
      .where(eq(orders.id, id))
      .run();
    expect(zOrderResult.parse((await view(id)).body).order).toMatchObject({
      status: 'failed',
      errorCode: 'SERVER_PRICE_CHANGED',
      dragonLine: '가게 가격이 바뀌었어용. 새 금액을 다시 확인해 주세용',
      dragonMood: 'worried',
    });
    h.db.update(orders).set({ errorCode: 'CHAIN_PERIODIC_LIMIT' }).where(eq(orders.id, id)).run();
    expect(zOrderResult.parse((await view(id)).body).order.dragonLine).toBe(
      '30일 상한에 도달했어요',
    );
  });

  it('arrival counts from the press, not from the quote', async () => {
    const { quote, confirm, view } = await setup();
    const id = await quote();
    vi.setSystemTime(NOW + 5 * 60_000); // pressed five minutes after the quote
    await confirm(id);
    expect(zOrderResult.parse((await view(id)).body).order.etaAt).toBe(NOW + 8 * 60_000);
  });

  it('another user order is 404, and the read changes nothing', async () => {
    const { quote, view, row } = await setup();
    const id = await quote();
    expect((await view(id, 'u2')).status).toBe(404);
    expect((await view('nope')).status).toBe(404);
    expect(row(id)?.status).toBe('quoted');
  });
});

describe('requote then confirm (user-flow 12): the other rules still hold', () => {
  it('over the limit at a new store: after the raise and requote, confirm asks for the new store and pays nothing', async () => {
    const { h, post, payment, confirm } = await setup();
    insertMerchant(h.db, 'm2', { name: '처음국수' });
    insertMenu(h.db, 'x-guksu', 'm2', 7_000n, { name: '잔치국수' });
    const pay = vi.spyOn(payment, 'pay');
    // 14,000 at a store never seen: the per-order rule matches first (OVER_LEVEL_LIMIT).
    const first = zCreateOrderResult.parse(
      (
        await post('u1', '/api/orders', {
          merchantId: 'm2',
          items: [{ menuId: 'x-guksu', qty: 2 }],
          clientOrderId: 'c-new-over',
        })
      ).body,
    );
    expect(first.order.status).toBe('pending_approval');
    expect(h.db.select().from(approvals).get()?.reason).toBe('OVER_LEVEL_LIMIT');
    // The owner raised the limit (PUT /agents/me/limits, done by hand here) and the order is quoted again.
    h.db
      .update(agents)
      .set({ perOrderLimitAokrw: W('15000') })
      .where(eq(agents.id, 'a-u1'))
      .run();
    const requoted = zCreateOrderResult.parse(
      (await post('u1', `/api/orders/${first.order.id}/requote`)).body,
    );
    expect(requoted.order.status).toBe('quoted');
    // The press checks every rule again: now the new store asks the owner. Nothing is paid.
    const res = zOrderResult.parse((await confirm(first.order.id)).body);
    expect(res.order.status).toBe('pending_approval');
    expect(pay).not.toHaveBeenCalled();
    const rows = h.db.select().from(approvals).all();
    expect(rows.map((r) => [r.reason, r.status])).toEqual([
      ['OVER_LEVEL_LIMIT', 'approved'],
      ['NEW_MERCHANT', 'pending'],
    ]);
  });
});
