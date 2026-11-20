import { getPolicy, type Hex, okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../config/env.js';
import { MOCK_OPERATOR, MockPaymentProvider } from './mock-payment.provider.js';
import { createPaymentProvider } from './payment.service.js';

const won = (n: bigint) => okrwToAokrw(n);
const REF = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;
const T0 = Date.parse('2026-12-01T03:00:00.000Z'); // 12:00 KST

function setup(profile: 'default' | 'demo' = 'default') {
  let now = T0;
  const p = new MockPaymentProvider(getPolicy(profile), () => now);
  return {
    p,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

async function ready(p: MockPaymentProvider, limit: bigint, balance: bigint) {
  const agent = await p.createAgent({ userId: 'u1', name: '용이' });
  await p.setTransferLimit(agent, limit);
  await p.fund(agent, balance);
  return agent;
}

const req = (agent: Awaited<ReturnType<typeof ready>>, amount: bigint, ref = 1) => ({
  agent,
  merchantOnchainId: 1n,
  amount,
  orderRef: REF(ref),
});

describe('MockPaymentProvider (refusals follow chain-and-pcl.md)', () => {
  it('creates a stable wallet per user, owned by the operator', async () => {
    const { p } = setup();
    const a = await p.createAgent({ userId: 'u1', name: '용이' });
    const b = await p.createAgent({ userId: 'u1', name: '용이' });
    expect(a.address).toBe(b.address);
    expect(a.address).toMatch(/^0x[0-9a-f]{40}$/);
    expect(a.ownerAddress).toBe(MOCK_OPERATOR);
    expect((await p.createAgent({ userId: 'u2', name: 'x' })).address).not.toBe(a.address);
  });

  it('refuses before the TransferLimit is written (CHAIN_AGENT_LIMIT_UNSET)', async () => {
    const { p } = setup();
    const agent = await p.createAgent({ userId: 'u1', name: '용이' });
    await p.fund(agent, won(50_000n));
    expect(await p.preflight(req(agent, won(9_000n)))).toEqual({
      ok: false,
      error: { code: 'CHAIN_AGENT_LIMIT_UNSET' },
    });
  });

  it('pays within the limit, takes the money and records the orderRef once', async () => {
    const { p } = setup();
    const agent = await ready(p, won(10_000n), won(20_000n));
    const r = await p.pay(req(agent, won(9_000n)));
    expect(r.ok).toBe(true);
    expect(await p.balanceOf(agent.address)).toBe(won(11_000n));
    expect(await p.findPaid(REF(1))).toEqual(
      r.ok ? { txHash: r.txHash, blockNumber: r.blockNumber } : null,
    );
    // Same orderRef again: OrderExists (not in the revert table, so INTERNAL), nothing taken.
    expect(await p.pay(req(agent, won(9_000n)))).toEqual({
      ok: false,
      stage: 'execution',
      error: { code: 'INTERNAL' },
    });
    expect(await p.balanceOf(agent.address)).toBe(won(11_000n));
    expect(await p.findPaid(REF(2))).toBeNull();
  });

  it('refuses over the per-order limit with the max for the dragon line', async () => {
    const { p } = setup();
    const agent = await ready(p, won(10_000n), won(50_000n));
    expect(await p.pay(req(agent, won(10_001n)))).toEqual({
      ok: false,
      stage: 'execution',
      error: { code: 'CHAIN_AGENT_LIMIT', params: { max: '10,000원' } },
    });
    expect((await p.pay(req(agent, won(10_000n), 2))).ok).toBe(true);
  });

  it('refuses past the 30-day cap and opens again when the window ends (demo: 60,000 / 1h)', async () => {
    const { p, advance } = setup('demo');
    const agent = await ready(p, won(50_000n), won(200_000n));
    expect((await p.pay(req(agent, won(50_000n), 1))).ok).toBe(true);
    expect(await p.pay(req(agent, won(10_001n), 2))).toEqual({
      ok: false,
      stage: 'execution',
      error: { code: 'CHAIN_PERIODIC_LIMIT', params: { resetAt: '12월 1일 오후 1시' } },
    });
    expect((await p.pay(req(agent, won(10_000n), 3))).ok).toBe(true); // exactly 60,000
    advance(3_600_000 - 1);
    expect((await p.pay(req(agent, won(1n), 4))).ok).toBe(false);
    advance(1);
    expect((await p.pay(req(agent, won(9_000n), 5))).ok).toBe(true);
  });

  it('refuses a paused agent and an empty wallet', async () => {
    const { p } = setup();
    const agent = await ready(p, won(10_000n), won(5_000n));
    expect(await p.preflight(req(agent, won(9_000n)))).toEqual({
      ok: false,
      error: { code: 'CHAIN_INSUFFICIENT_FUNDS' },
    });
    await p.freeze(agent);
    expect(await p.preflight(req(agent, won(1_000n)))).toEqual({
      ok: false,
      error: { code: 'CHAIN_AGENT_PAUSED' },
    });
    await p.unfreeze(agent);
    expect((await p.preflight(req(agent, won(1_000n)))).ok).toBe(true);
    await p.drain(agent);
    expect(await p.balanceOf(agent.address)).toBe(0n);
  });

  it('keeps bigint precision past Number (9,000원 + 1 aokrw is not a double)', async () => {
    const { p } = setup();
    const amount = won(9_000n) + 1n;
    const agent = await ready(p, won(10_000n), amount + 2n);
    expect((await p.pay(req(agent, amount))).ok).toBe(true);
    expect(await p.balanceOf(agent.address)).toBe(2n);
  });
});

describe('MockPaymentProvider money edges', () => {
  it.each([0n, -1n, -won(5_000n)])(
    'refuses a %s aokrw payment and keeps the money and the orderRef',
    async (amount) => {
      const { p } = setup();
      const agent = await ready(p, won(10_000n), won(1_000n));
      expect(await p.pay(req(agent, amount, 7))).toEqual({
        ok: false,
        stage: 'execution',
        error: { code: 'INTERNAL' },
      });
      expect(await p.balanceOf(agent.address)).toBe(won(1_000n));
      expect(await p.findPaid(REF(7))).toBeNull();
      expect((await p.pay(req(agent, won(1_000n), 7))).ok).toBe(true); // the orderRef is still free
    },
  );

  it('refuses a zero or negative fund and TransferLimit', async () => {
    const { p } = setup();
    const agent = await p.createAgent({ userId: 'u1', name: '용이' });
    await expect(p.fund(agent, -won(1_000n))).rejects.toMatchObject({ code: 'INTERNAL' });
    await expect(p.fund(agent, 0n)).rejects.toMatchObject({ code: 'INTERNAL' });
    await expect(p.setTransferLimit(agent, 0n)).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(await p.balanceOf(agent.address)).toBe(0n);
  });

  it('pays exactly the whole balance; one aokrw short is CHAIN_INSUFFICIENT_FUNDS at submit', async () => {
    const { p } = setup();
    const agent = await ready(p, won(10_000n), won(9_000n));
    expect(await p.pay(req(agent, won(9_000n) + 1n, 1))).toEqual({
      ok: false,
      stage: 'submit',
      error: { code: 'CHAIN_INSUFFICIENT_FUNDS' },
    });
    expect((await p.pay(req(agent, won(9_000n), 2))).ok).toBe(true);
    expect(await p.balanceOf(agent.address)).toBe(0n);
  });

  it('dates resetAt from the first order of the window, not from now', async () => {
    const { p, advance } = setup('demo');
    const agent = await ready(p, won(50_000n), won(200_000n));
    expect((await p.pay(req(agent, won(50_000n), 1))).ok).toBe(true); // window opens 12:00 KST
    advance(10 * 60_000); // 12:10
    expect(await p.pay(req(agent, won(20_000n), 2))).toEqual({
      ok: false,
      stage: 'execution',
      error: { code: 'CHAIN_PERIODIC_LIMIT', params: { resetAt: '12월 1일 오후 1시' } },
    });
  });
});

describe('MockPaymentProvider refusal order when reasons overlap ((추론), payment.md)', () => {
  it('short balance comes first (submit), before an unset limit', async () => {
    const { p } = setup();
    const agent = await p.createAgent({ userId: 'u1', name: '용이' });
    expect(await p.preflight(req(agent, won(9_000n)))).toEqual({
      ok: false,
      error: { code: 'CHAIN_INSUFFICIENT_FUNDS' },
    });
  });

  it('an unset limit comes before a pause', async () => {
    const { p } = setup();
    const agent = await p.createAgent({ userId: 'u1', name: '용이' });
    await p.fund(agent, won(9_000n));
    await p.freeze(agent);
    expect(await p.preflight(req(agent, won(9_000n)))).toEqual({
      ok: false,
      error: { code: 'CHAIN_AGENT_LIMIT_UNSET' },
    });
  });

  it('the per-order limit (preCall) comes before a pause (contract body)', async () => {
    const { p } = setup();
    const agent = await ready(p, won(10_000n), won(50_000n));
    await p.freeze(agent);
    expect(await p.preflight(req(agent, won(20_000n)))).toEqual({
      ok: false,
      error: { code: 'CHAIN_AGENT_LIMIT', params: { max: '10,000원' } },
    });
  });

  it('the 30-day cap (preCall) comes before a pause (body)', async () => {
    const { p } = setup('demo');
    const agent = await ready(p, won(50_000n), won(200_000n));
    expect((await p.pay(req(agent, won(50_000n), 1))).ok).toBe(true);
    await p.freeze(agent);
    expect(await p.preflight(req(agent, won(20_000n), 2))).toEqual({
      ok: false,
      error: { code: 'CHAIN_PERIODIC_LIMIT', params: { resetAt: '12월 1일 오후 1시' } },
    });
  });

  // tech-spec 5.2 placeOrder body: AgentIsPaused, then BadAmount, then OrderExists.
  it('in the body, a pause comes before a used orderRef and before a zero amount', async () => {
    const { p } = setup();
    const agent = await ready(p, won(10_000n), won(50_000n));
    expect((await p.pay(req(agent, won(1_000n), 1))).ok).toBe(true);
    await p.freeze(agent);
    expect(await p.preflight(req(agent, won(1_000n), 1))).toEqual({
      ok: false,
      error: { code: 'CHAIN_AGENT_PAUSED' },
    });
    expect(await p.preflight(req(agent, 0n, 2))).toEqual({
      ok: false,
      error: { code: 'CHAIN_AGENT_PAUSED' },
    });
    await p.unfreeze(agent);
    expect(await p.preflight(req(agent, 0n, 1))).toEqual({
      ok: false,
      error: { code: 'INTERNAL' },
    }); // BadAmount
    expect(await p.preflight(req(agent, won(1_000n), 1))).toEqual({
      ok: false,
      error: { code: 'INTERNAL' },
    }); // OrderExists
    expect((await p.preflight(req(agent, won(1_000n), 2))).ok).toBe(true);
  });
});

describe('createPaymentProvider (D-05)', () => {
  it('gives the mock for PAYMENT_PATH=mock', () => {
    expect(createPaymentProvider(loadConfig({ PAYMENT_PATH: 'mock' })).path).toBe('mock');
  });

  it.each(['A', 'B', 'C'] as const)(
    'path %s fails every call until it is wired, never pays',
    async (path) => {
      const p = createPaymentProvider(loadConfig({ PAYMENT_PATH: path }));
      expect(p.path).toBe(path);
      await expect(
        p.pay({
          agent: { agentRowId: 'a', address: '0x1', ownerAddress: '0x2' },
          merchantOnchainId: 1n,
          amount: 1n,
          orderRef: REF(1),
        }),
      ).rejects.toMatchObject({ code: 'INTERNAL' });
    },
  );
});
