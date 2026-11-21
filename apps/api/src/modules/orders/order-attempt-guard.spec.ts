import 'reflect-metadata';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import {
  AppError,
  type AgentWallet,
  type OwnerAuthority,
  type PaymentProvider,
  zCreateOrderResult,
  zOrderResult,
} from '@sikyeoyong/shared';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { agents, allowedMerchants, approvals, orders } from '../../db/schema/index.js';
import { fakeReceipts, insertMenu, insertMerchant, insertUser } from '../../test/fixtures.js';
import { AgentLockTimeout, AgentsService } from '../agents/agents.service.js';
import { AllowanceService } from '../allowance/allowance.service.js';
import type { ApprovalsService } from '../approvals/approvals.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CHAIN_READER } from '../chain/chain.service.js';
import { OWNER_AUTHORITY, PAYMENT_PROVIDER } from '../payment/payment.service.js';
import { OrderRules } from './order-rules.service.js';
import { OrderSettler } from './order-settler.service.js';
import { OrdersModule } from './orders.module.js';
import { OrdersRepository } from './orders.repository.js';

// A write of a confirm attempt carries the attempt number it started with (payment.md "대기열에는
// 상한이 있다"). With the order submitting at attempt 2, a write of attempt 1 must change nothing.

const NOW = Date.parse('2026-12-10T03:00:00.000Z');
const W = (won: string) => BigInt(`${won}000000000000000000`);

const open: { close: () => Promise<void> | void }[] = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const o of open.splice(0)) await o.close();
});

describe('attempt guard: repository and writers, submitting at attempt 2', () => {
  function setup() {
    const h = openDb(':memory:');
    runMigrations(h.db);
    open.push({
      close: () => {
        h.close();
      },
    });
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
        attempt: 2,
        createdAt: 1,
        updatedAt: 1,
      })
      .run();
    const repo = new OrdersRepository(h);
    const openWithOrder = vi.fn((_input: unknown, move: () => void) => {
      move();
    });
    const settler = new OrderSettler(repo, { openWithOrder } as unknown as ApprovalsService);
    const row = () => {
      const r = repo.findForUser('o1', 'u1');
      if (r === undefined) throw new Error('order missing');
      return r;
    };
    return { h, repo, settler, receipts: fakeReceipts(repo, 'B'), row, openWithOrder };
  }
  const tx = `0x${'cd'.repeat(32)}`;

  it('markFundStart', () => {
    const { repo, row } = setup();
    expect(repo.markFundStart('o1', '5', 1, 10)).toBe(false);
    expect(row().fundStartedAt).toBeNull();
    expect(repo.markFundStart('o1', '5', 2, 10)).toBe(true);
    expect(row().fundStartedAt).toBe(10);
  });

  it('clearFundStart', () => {
    const { repo, row } = setup();
    repo.markFundStart('o1', '5', 2, 10);
    repo.clearFundStart('o1', 1, 11);
    expect(row()).toMatchObject({ fundStartedAt: 10, fundAmountAokrw: '5' });
    repo.clearFundStart('o1', 2, 12);
    expect(row()).toMatchObject({ fundStartedAt: null, fundAmountAokrw: null });
  });

  it('the submit marker and the signed hash save (transition)', () => {
    const { repo, row } = setup();
    expect(repo.transition('o1', 'submitting', { submitStartedAt: 10 }, 10, { attempt: 1 })).toBe(
      false,
    );
    expect(row().submitStartedAt).toBeNull();
    expect(repo.transition('o1', 'submitting', { submitStartedAt: 10 }, 10, { attempt: 2 })).toBe(
      true,
    );
    const hash = { submitTxHash: tx, submitNonce: 7 };
    expect(repo.transition('o1', 'submitting', hash, 11, { attempt: 1 })).toBe(false);
    expect(row()).toMatchObject({ submitTxHash: null, submitNonce: null });
    expect(repo.transition('o1', 'submitting', hash, 11, { attempt: 2 })).toBe(true);
    expect(row()).toMatchObject({ submitTxHash: tx, submitNonce: 7 });
  });

  it('markPaid', () => {
    const { receipts, row } = setup();
    expect(receipts.markPaid(row(), 'submitting', tx, 10, 1)).toBe(false);
    expect(row()).toMatchObject({ status: 'submitting', txHash: null });
    expect(receipts.markPaid(row(), 'submitting', tx, 10, 2)).toBe(true);
    expect(row()).toMatchObject({ status: 'paid', txHash: tx });
  });

  it.each([
    ['a retryable refusal after the marker', 'CHAIN_AGENT_PAUSED', true, 'failed'],
    ['a final refusal after the marker', 'CHAIN_MERCHANT_INACTIVE', true, 'failed'],
    ['an unrelated refusal before the marker', 'RATE_LIMITED', false, 'failed'],
  ] as const)('settle: %s', (_name, code, marked, to) => {
    const { settler, row } = setup();
    expect(settler.settle('u1', row(), code, marked, 10, 1)).toBe(false);
    expect(row().status).toBe('submitting');
    expect(settler.settle('u1', row(), code, marked, 10, 2)).toBe(true);
    expect(row().status).toBe(to);
  });

  it('settle into an approval (toApproval)', () => {
    const { settler, row, openWithOrder } = setup();
    expect(() => settler.settle('u1', row(), 'CHAIN_AGENT_LIMIT', true, 10, 1)).toThrow(AppError);
    expect(row().status).toBe('submitting');
    expect(settler.settle('u1', row(), 'CHAIN_AGENT_LIMIT', true, 10, 2)).toBe(true);
    expect(row().status).toBe('pending_approval');
    expect(openWithOrder).toHaveBeenCalledTimes(2);
  });
});

describe('attempt guard: a confirm turn whose attempt was overtaken writes nothing', () => {
  async function setup(opts: { owner?: OwnerAuthority } = {}) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const h = openDb(':memory:');
    runMigrations(h.db);
    insertUser(h.db, 'u1', { dong: '역삼동' });
    insertMerchant(h.db, 'm1', { name: '마루국밥' });
    insertMenu(h.db, 'x-dwaeji', 'm1', 9_000n, { name: '돼지국밥' });
    h.db.insert(allowedMerchants).values({ userId: 'u1', merchantId: 'm1', approvedAt: 1 }).run();
    let builder = Test.createTestingModule({ imports: [OrdersModule] })
      .useMocker((t) =>
        t === DB
          ? h
          : t === APP_CONFIG
            ? loadConfig({ PAYMENT_PATH: 'mock', DEMO_MODE: 'false' })
            : undefined,
      )
      .overrideProvider(CHAIN_READER)
      .useValue({
        periodicVolume: () => Promise.resolve({ usedAokrw: 0n, resetAtSec: null }),
      });
    if (opts.owner !== undefined)
      builder = builder.overrideProvider(OWNER_AUTHORITY).useValue(opts.owner);
    const moduleRef = await builder.compile();
    const app = configureApp(moduleRef.createNestApplication());
    await app.init();
    open.push({
      close: async () => {
        await app.close();
        h.close();
      },
    });
    const payment = moduleRef.get<PaymentProvider>(PAYMENT_PROVIDER);
    const wallet: AgentWallet = await payment.createAgent({ userId: 'u1', name: '용이' });
    await payment.setTransferLimit(wallet, W('10000'));
    h.db
      .update(agents)
      .set({
        walletAddress: wallet.address,
        ownerAddress: wallet.ownerAddress,
        onchainAgentId: wallet.onchainAgentId?.toString() ?? null,
      })
      .where(eq(agents.id, 'a-u1'))
      .run();
    moduleRef.get(AllowanceService).record('u1', 'trial', W('1000000'), null, NOW);
    const token = moduleRef.get(AuthService).issue('u1', 'web');
    const post = (path: string, body: object = {}) =>
      request(app.getHttpServer() as Server)
        .post(path)
        .set('Cookie', `sid=${token}`)
        .set('X-Requested-With', 'fetch')
        .send(body);
    const quote = async () =>
      zCreateOrderResult.parse(
        (
          await post('/api/orders', {
            merchantId: 'm1',
            items: [{ menuId: 'x-dwaeji', qty: 1 }],
            clientOrderId: 'c1',
          })
        ).body,
      ).order.id;
    const confirm = (id: string) => post(`/api/orders/${id}/confirm`);
    const row = (id: string) => h.db.select().from(orders).where(eq(orders.id, id)).get();
    /** A newer press took over: the order stays submitting, its attempt goes up. */
    const overtake = (id: string) =>
      h.db
        .update(orders)
        .set({ attempt: sql`${orders.attempt} + 1` })
        .where(eq(orders.id, id))
        .run();
    return {
      h,
      payment,
      wallet,
      quote,
      confirm,
      row,
      overtake,
      rules: moduleRef.get(OrderRules, { strict: false }),
      lock: moduleRef.get(AgentsService, { strict: false }),
      repo: moduleRef.get(OrdersRepository),
    };
  }

  /** The press answers with the order as it is: still submitting, now at attempt 2. */
  const expectOvertaken = (r: unknown) => {
    expect(r).toMatchObject({ status: 'submitting', attempt: 2 });
  };

  it('the top-up marker and everything after it', async () => {
    const { payment, quote, confirm, row, overtake } = await setup();
    const real = payment.balanceOf.bind(payment);
    vi.spyOn(payment, 'balanceOf').mockImplementationOnce(async (a) => {
      const b = await real(a);
      overtake(id);
      return b;
    });
    const fund = vi.spyOn(payment, 'fund');
    const pay = vi.spyOn(payment, 'pay');
    const id = await quote();
    expect(zOrderResult.parse((await confirm(id)).body).order.status).toBe('submitting');
    expectOvertaken(row(id));
    expect(row(id)).toMatchObject({ fundStartedAt: null, submitStartedAt: null, errorCode: null });
    expect(fund).not.toHaveBeenCalled();
    expect(pay).not.toHaveBeenCalled();
  });

  it('taking the top-up marker back (the owner has not signed)', async () => {
    const owner: OwnerAuthority = {
      mode: 'pouch',
      prepare: (action) => {
        overtake(id);
        return Promise.resolve({ id: 'p1', action, signer: 'user' });
      },
      confirm: () => Promise.reject(new Error('must not confirm')),
    };
    const { quote, confirm, row, overtake } = await setup({ owner });
    const id = await quote();
    await confirm(id);
    expectOvertaken(row(id));
    // The newer press owns the marker: the old turn does not take it back.
    expect(row(id)?.fundStartedAt).toBe(NOW);
    expect(row(id)?.errorCode).toBeNull();
  });

  it('the submit marker', async () => {
    const { payment, quote, confirm, row, overtake } = await setup();
    const real = payment.preflight.bind(payment);
    vi.spyOn(payment, 'preflight').mockImplementationOnce(async (req) => {
      const r = await real(req);
      overtake(id);
      return r;
    });
    const pay = vi.spyOn(payment, 'pay');
    const id = await quote();
    await confirm(id);
    expectOvertaken(row(id));
    expect(row(id)).toMatchObject({ submitStartedAt: null, errorCode: null });
    expect(pay).not.toHaveBeenCalled();
  });

  it('the settle of a refusal before the marker', async () => {
    const { payment, quote, confirm, row, overtake } = await setup();
    vi.spyOn(payment, 'preflight').mockImplementationOnce(() => {
      overtake(id);
      return Promise.resolve({
        ok: false,
        stage: 'preflight',
        error: { code: 'CHAIN_AGENT_PAUSED' },
      } as never);
    });
    const id = await quote();
    await confirm(id);
    expectOvertaken(row(id));
    expect(row(id)?.errorCode).toBeNull();
  });

  it('the approval move after the checks', async () => {
    const { h, rules, quote, confirm, row, overtake } = await setup();
    const id = await quote();
    vi.spyOn(rules, 'approvalNeeded').mockImplementationOnce(() => {
      overtake(id);
      return 'SERVER_OVER_LEVEL';
    });
    await confirm(id);
    expectOvertaken(row(id));
    expect(h.db.select().from(approvals).all()).toHaveLength(0);
  });

  it('the signed hash save', async () => {
    const { payment, quote, confirm, row, overtake } = await setup();
    const real = payment.pay.bind(payment);
    vi.spyOn(payment, 'pay').mockImplementationOnce(async (req) => {
      overtake(id);
      await req.beforeBroadcast?.({ txHash: `0x${'ab'.repeat(32)}`, nonce: 7 });
      return real(req);
    });
    const id = await quote();
    await confirm(id);
    expectOvertaken(row(id));
    expect(row(id)).toMatchObject({ submitTxHash: null, submitNonce: null, txHash: null });
  });

  it('the paid move', async () => {
    const { payment, quote, confirm, row, overtake } = await setup();
    const real = payment.pay.bind(payment);
    vi.spyOn(payment, 'pay').mockImplementationOnce(async (req) => {
      const r = await real(req);
      overtake(id);
      return r;
    });
    const id = await quote();
    await confirm(id);
    expectOvertaken(row(id));
    expect(row(id)).toMatchObject({ txHash: null, receiptJson: null });
  });

  it.each([
    ['a retryable refusal of pay', 'CHAIN_AGENT_PAUSED'],
    ['a final refusal of pay', 'CHAIN_MERCHANT_INACTIVE'],
  ] as const)('the settle of %s', async (_name, code) => {
    const { payment, quote, confirm, row, overtake } = await setup();
    vi.spyOn(payment, 'pay').mockImplementationOnce(() => {
      overtake(id);
      return Promise.resolve({ ok: false, stage: 'execution', error: { code } } as never);
    });
    const id = await quote();
    await confirm(id);
    expectOvertaken(row(id));
    expect(row(id)?.errorCode).toBeNull();
  });

  it('the approval move after a refusal of pay', async () => {
    const { h, payment, quote, confirm, row, overtake } = await setup();
    vi.spyOn(payment, 'pay').mockImplementationOnce(() => {
      overtake(id);
      return Promise.resolve({
        ok: false,
        stage: 'execution',
        error: { code: 'CHAIN_AGENT_LIMIT' },
      } as never);
    });
    const id = await quote();
    await confirm(id);
    expectOvertaken(row(id));
    expect(h.db.select().from(approvals).all()).toHaveLength(0);
  });

  it('a second press holds at pay while the stale turn of the first wakes: one pay, one paid order', async () => {
    const { payment, quote, confirm, row, lock } = await setup();
    const gate = () => {
      let release: () => void = () => undefined;
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { wait, release };
    };
    const stale = gate();
    const hold = gate();
    const realBalance = payment.balanceOf.bind(payment);
    const balance = vi.spyOn(payment, 'balanceOf').mockImplementationOnce(async (address) => {
      const b = await realBalance(address);
      await stale.wait;
      return b;
    });
    const realPay = payment.pay.bind(payment);
    const pay = vi.spyOn(payment, 'pay').mockImplementation(async (req) => {
      await hold.wait;
      return realPay(req);
    });
    const fund = vi.spyOn(payment, 'fund');
    const marker = vi.spyOn(OrdersRepository.prototype, 'markFundStart');
    // Press 1 times out of the lock while its turn is blocked in balanceOf.
    vi.spyOn(lock, 'exclusive').mockImplementationOnce((_agentId, fn) => {
      void fn().catch(() => undefined);
      return vi
        .waitFor(() => {
          expect(balance).toHaveBeenCalled();
        })
        .then(() => {
          throw new AgentLockTimeout('hold');
        });
    });
    const id = await quote();
    expect(zOrderResult.parse((await confirm(id)).body).order.status).toBe('failed');
    // Press 2 retries (attempt 2) and holds at pay, still submitting.
    const second = confirm(id).then((r) => r);
    await vi.waitFor(() => {
      expect(pay).toHaveBeenCalledTimes(1);
    });
    expect(row(id)).toMatchObject({ status: 'submitting', attempt: 2 });
    expect(fund).toHaveBeenCalledTimes(1);
    // The stale attempt-1 turn wakes: its marker write is refused, nothing else follows.
    stale.release();
    await vi.waitFor(() => {
      expect(marker).toHaveBeenCalledTimes(2);
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(marker.mock.results[1]?.value).toBe(false);
    expect(fund).toHaveBeenCalledTimes(1);
    expect(pay).toHaveBeenCalledTimes(1);
    expect(row(id)).toMatchObject({ status: 'submitting', attempt: 2, errorCode: null });
    // Press 2 finishes: one pay, one paid order.
    hold.release();
    expect(zOrderResult.parse((await second).body).order.status).toBe('paid');
    expect(pay).toHaveBeenCalledTimes(1);
    expect(row(id)).toMatchObject({ status: 'paid', attempt: 2, errorCode: null });
  });
});
