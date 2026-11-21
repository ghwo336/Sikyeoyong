import { randomBytes } from 'node:crypto';
import { Abis, identityRegistryAbi } from '@maroo-chain/viem';
import { AppError, okrwToAokrw, type AgentWallet, type Hex } from '@sikyeoyong/shared';
import {
  decodeFunctionData,
  getAddress,
  encodeAbiParameters,
  encodeErrorResult,
  type Abi,
  encodeEventTopics,
  keccak256,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it, vi } from 'vitest';
import { ordersAbi } from '../../common/onchain/orders-abi.js';
import { AgentKeyVault, type SealedKeyRow } from './agent-key-vault.js';
import {
  ManagedEoaPaymentProvider,
  type ReceiptLike,
  type SimulateOutcome,
  type WalletPort,
} from './managed-eoa.provider.js';

const REGISTRY: Hex = '0x8004000000000000000000000000000000000001';
const PROXY: Hex = '0x36713c60A8b4E54b56997553aD4b8b16d7C02Db8';
const OPERATOR = privateKeyToAccount(`0x${randomBytes(32).toString('hex')}`);
const OWNER_ABI: Abi = [...ordersAbi.filter((i) => i.type === 'error'), ...Abis.errors];
const W = (won: bigint) => okrwToAokrw(won);
const REF: Hex = `0x${'ab'.repeat(32)}`;
const hash = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;

class MemoryStore {
  readonly rows = new Map<string, SealedKeyRow>();
  insert(row: SealedKeyRow) {
    this.rows.set(row.address, row);
  }
  find(address: string) {
    return this.rows.get(address);
  }
  findByAgentId(agentId: string) {
    return [...this.rows.values()].find((r) => r.agentId === agentId);
  }
  link(address: string, agentId: string) {
    const row = this.rows.get(address);
    if (row) this.rows.set(address, { ...row, agentId });
  }
  setOnchainAgentId(address: string, onchainAgentId: string) {
    const row = this.rows.get(address);
    if (row) this.rows.set(address, { ...row, onchainAgentId });
  }
}

const success = (n: number, logs: ReceiptLike['logs'] = [], blockNumber = 100n): ReceiptLike => ({
  status: 'success',
  blockNumber,
  transactionHash: hash(n),
  logs,
});

const placedLog = (orderRef: Hex): ReceiptLike['logs'][number] => ({
  address: PROXY,
  topics: encodeEventTopics({
    abi: ordersAbi,
    eventName: 'OrderPlaced',
    args: { orderRef, agent: OPERATOR.address, merchantId: 1n },
  }) as Hex[],
  data: encodeAbiParameters([{ type: 'uint256' }], [W(9_000n)]),
});

const registeredLog = (agentId: bigint): ReceiptLike['logs'][number] => ({
  address: REGISTRY,
  topics: encodeEventTopics({
    abi: identityRegistryAbi,
    eventName: 'Registered',
    args: { agentId, owner: OPERATOR.address },
  }) as Hex[],
  data: encodeAbiParameters([{ type: 'string' }], ['']),
});

const revertData = (errorName: string, args?: readonly unknown[]): Hex =>
  encodeErrorResult({ abi: OWNER_ABI, errorName, args });
const reverted = (data: Hex): Error => Object.assign(new Error('reverted'), { data });

function setup(opts: { balance?: bigint } = {}) {
  const store = new MemoryStore();
  const vault = new AgentKeyVault(randomBytes(32), store);
  const calls: string[] = [];
  const operatorSends: { to: Hex; data?: Hex; value?: bigint }[] = [];
  const receipts = new Map<Hex, ReceiptLike | Error>();
  const pub = {
    getBalance: vi.fn((): Promise<bigint> => Promise.resolve(opts.balance ?? W(12_000n))),
    getTransactionCount: vi.fn(() => Promise.resolve(3)),
    getBlock: vi.fn(() => Promise.resolve({ timestamp: 1_000n })),
    estimateGas: vi.fn(() => Promise.resolve(150_000n)),
    call: vi.fn((): Promise<unknown> => Promise.resolve({ data: '0x' })),
    waitForTransactionReceipt: vi.fn(({ hash: h }: { hash: Hex }) => {
      const r = receipts.get(h);
      if (r === undefined) return Promise.reject(new Error(`no receipt for ${h}`));
      return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
    }),
    getTransactionReceipt: vi.fn(({ hash: h }: { hash: Hex }) => {
      const r = receipts.get(h);
      if (r === undefined || r instanceof Error) {
        return Promise.reject(
          Object.assign(new Error('not found'), { name: 'TransactionReceiptNotFoundError' }),
        );
      }
      return Promise.resolve(r);
    }),
    getTransaction: vi.fn((): Promise<{ from: Hex; to: Hex | null; input: Hex; value: bigint }> =>
      Promise.resolve({ from: OPERATOR.address, to: PROXY, input: '0xabcd', value: 9n }),
    ),
    sendRawTransaction: vi.fn((): Promise<Hex> => {
      calls.push('broadcast');
      return Promise.resolve(hash(0));
    }),
    getLogs: vi.fn(
      (): Promise<readonly { transactionHash: Hex | null; blockNumber: bigint | null }[]> =>
        Promise.resolve([]),
    ),
    // getAgentWallet: the wallet of the last setAgentWallet the operator sent (zero if none).
    readContract: vi.fn((): Promise<unknown> => {
      // only mined, successful link txs count (the n-th send has hash 1000 + n)
      const last = operatorSends
        .map((tx, i) => ({
          d: decodeFunctionData({ abi: identityRegistryAbi, data: tx.data ?? '0x' }),
          ok: (receipts.get(hash(1001 + i)) as ReceiptLike | undefined)?.status === 'success',
        }))
        .filter((x) => x.ok && x.d.functionName === 'setAgentWallet')
        .map((x) => x.d)
        .at(-1);
      return Promise.resolve(
        last === undefined
          ? '0x0000000000000000000000000000000000000000'
          : (last.args as readonly unknown[])[1],
      );
    }),
    pcl: {
      simulatePclProxy: vi.fn((): Promise<SimulateOutcome> =>
        Promise.resolve({ status: 'succeeded' }),
      ),
    },
  };
  let sendCount = 0;
  const operatorWallet: WalletPort = {
    prepareTransactionRequest: vi.fn(),
    signTransaction: vi.fn(),
    sendTransaction: vi.fn((tx: { to: Hex; data?: Hex; value?: bigint }) => {
      operatorSends.push(tx);
      sendCount += 1;
      const h = hash(1_000 + sendCount);
      return Promise.resolve(h);
    }),
  };
  const agentWallet = {
    prepareTransactionRequest: vi.fn((a: { gas?: bigint; value?: bigint; nonce?: number }) =>
      Promise.resolve({ ...a, gas: a.gas ?? 21_000n, maxFeePerGas: 10n }),
    ),
    signTransaction: vi.fn(() => {
      calls.push('sign');
      return Promise.resolve('0x02f8abcdef' as Hex);
    }),
    sendTransaction: vi.fn(),
  };
  const walletAccounts: string[] = [];
  const signWalletAuthorization = vi.fn(() => Promise.resolve('0x1234' as Hex));
  const provider = new ManagedEoaPaymentProvider({
    publicClient: pub,
    operatorWallet,
    walletFor: (account) => {
      walletAccounts.push(account.address.toLowerCase());
      return agentWallet;
    },
    signWalletAuthorization,
    vault,
    config: {
      operator: OPERATOR,
      registry: REGISTRY,
      proxy: PROXY,
      deployBlock: 23_000_000n,
      gasShareAokrw: W(100n),
      confirmations: 1,
      receiptTimeoutMs: 1_000,
    },
  });
  const agent: AgentWallet = {
    agentRowId: 'a1',
    address: vault.create('a1'),
    onchainAgentId: 31_312n,
    ownerAddress: OPERATOR.address,
  };
  const req = (amount = W(9_000n), orderRef = REF) => ({
    agent,
    merchantOnchainId: 1n,
    amount,
    orderRef,
  });
  return {
    provider,
    vault,
    store,
    pub,
    operatorWallet,
    agentWallet,
    operatorSends,
    receipts,
    calls,
    agent,
    req,
    signWalletAuthorization,
    walletAccounts,
  };
}

describe('createAgent', () => {
  it('saves the key first, registers, links the wallet with the agent signature, and checks the link', async () => {
    const t = setup();
    t.receipts.set(hash(1001), success(1001, [registeredLog(77n)]));
    t.receipts.set(hash(1002), success(1002));
    const keysBefore = t.store.rows.size;
    t.operatorWallet.sendTransaction = vi.fn((tx: { to: Hex; data?: Hex; value?: bigint }) => {
      // The key is already in the vault when the first chain write goes out.
      if (t.operatorSends.length === 0) expect(t.store.rows.size).toBe(keysBefore + 1);
      t.operatorSends.push(tx);
      return Promise.resolve(hash(1000 + t.operatorSends.length));
    });
    const wallet = await t.provider.createAgent({ userId: 'u', name: '용이', agentRowId: 'row-9' });
    const [register, link] = t.operatorSends;
    expect(register?.to).toBe(REGISTRY);
    expect(
      decodeFunctionData({ abi: identityRegistryAbi, data: register?.data ?? '0x' }).functionName,
    ).toBe('register');
    const linkCall = decodeFunctionData({ abi: identityRegistryAbi, data: link?.data ?? '0x' });
    expect(linkCall.functionName).toBe('setAgentWallet');
    // agentId from the event, the agent's own address, a deadline 240 s after the chain's clock.
    expect(linkCall.args).toEqual([77n, getAddress(wallet.address), 1_240n, '0x1234']);
    expect(t.signWalletAuthorization).toHaveBeenCalledWith(expect.anything(), {
      agentId: 77n,
      newWallet: wallet.address,
      owner: OPERATOR.address,
      deadline: 1_240n,
    });
    expect(wallet).toMatchObject({
      agentRowId: 'row-9',
      onchainAgentId: 77n,
      ownerAddress: OPERATOR.address,
    });
    expect(t.vault.has(wallet.address)).toBe(true);
  });

  it('fails when the registry did not link the wallet it was asked to', async () => {
    const t = setup();
    t.receipts.set(hash(1001), success(1001, [registeredLog(77n)]));
    t.receipts.set(hash(1002), success(1002));
    t.pub.readContract.mockResolvedValue('0x0000000000000000000000000000000000000000');
    await expect(t.provider.createAgent({ userId: 'u', name: 'n' })).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('a retry after a partway failure reuses the saved key and succeeds for the same row', async () => {
    const t = setup();
    // first attempt: the register tx emits no Registered event, so it fails after the key is saved
    t.receipts.set(hash(1001), success(1001, []));
    await expect(
      t.provider.createAgent({ userId: 'u', name: 'n', agentRowId: 'row-5' }),
    ).rejects.toThrow();
    const rowsAfterFail = t.store.rows.size;
    const orphan = t.vault.addressFor('row-5');
    expect(orphan).toBeDefined();
    t.receipts.set(hash(1002), success(1002, [registeredLog(88n)]));
    t.receipts.set(hash(1003), success(1003));
    const wallet = await t.provider.createAgent({ userId: 'u', name: 'n', agentRowId: 'row-5' });
    expect(wallet.address).toBe(orphan);
    expect(wallet.onchainAgentId).toBe(88n);
    expect(t.store.rows.size).toBe(rowsAfterFail);
  });

  it('a retry after register succeeded reuses the saved 8004 id and registers only once', async () => {
    const t = setup();
    t.receipts.set(hash(1001), success(1001, [registeredLog(55n)]));
    t.receipts.set(hash(1002), { ...success(1002), status: 'reverted' });
    await expect(
      t.provider.createAgent({ userId: 'u', name: 'n', agentRowId: 'row-7' }),
    ).rejects.toThrow();
    const address = t.vault.addressFor('row-7') as Hex;
    expect(t.vault.onchainAgentIdOf(address)).toBe(55n);
    t.receipts.set(hash(1003), success(1003));
    const wallet = await t.provider.createAgent({ userId: 'u', name: 'n', agentRowId: 'row-7' });
    const fns = t.operatorSends.map(
      (tx) => decodeFunctionData({ abi: identityRegistryAbi, data: tx.data ?? '0x' }).functionName,
    );
    expect(fns).toEqual(['register', 'setAgentWallet', 'setAgentWallet']);
    expect(wallet.onchainAgentId).toBe(55n);
    const retryLink = decodeFunctionData({
      abi: identityRegistryAbi,
      data: t.operatorSends[2]?.data ?? '0x',
    });
    expect((retryLink.args as readonly unknown[])[0]).toBe(55n);
  });

  it('a retry after setAgentWallet went through does not send it again', async () => {
    const t = setup();
    t.receipts.set(hash(1001), success(1001, [registeredLog(66n)]));
    t.receipts.set(hash(1002), success(1002));
    // the first attempt dies on the post-check read, after the link tx was mined
    t.pub.readContract
      .mockImplementationOnce(() => Promise.resolve('0x0000000000000000000000000000000000000000'))
      .mockImplementationOnce(() => Promise.reject(new Error('rpc down')));
    await expect(
      t.provider.createAgent({ userId: 'u', name: 'n', agentRowId: 'row-8' }),
    ).rejects.toThrow();
    expect(t.operatorSends).toHaveLength(2);
    const wallet = await t.provider.createAgent({ userId: 'u', name: 'n', agentRowId: 'row-8' });
    expect(t.operatorSends).toHaveLength(2);
    expect(wallet.onchainAgentId).toBe(66n);
  });

  it('a funded orphan key is kept and recorded, never replaced by a new one', async () => {
    const t = setup({ balance: W(500n) });
    t.receipts.set(hash(1001), success(1001, []));
    await expect(
      t.provider.createAgent({ userId: 'u', name: 'n', agentRowId: 'row-6' }),
    ).rejects.toThrow();
    const orphan = t.vault.addressFor('row-6') as Hex;
    expect(await t.provider.balanceOf(orphan)).toBe(W(500n));
    t.receipts.set(hash(1002), success(1002, [registeredLog(90n)]));
    t.receipts.set(hash(1003), success(1003));
    const wallet = await t.provider.createAgent({ userId: 'u', name: 'n', agentRowId: 'row-6' });
    expect(wallet.address).toBe(orphan);
    // the key still opens, so the funds stay reachable (drain works on it)
    await expect(
      t.vault.withAccount(orphan, (a) => Promise.resolve(a.address.toLowerCase())),
    ).resolves.toBe(orphan);
  });

  it('fails without a Registered event, and when the register tx reverts', async () => {
    const t = setup();
    t.receipts.set(hash(1001), success(1001, []));
    await expect(t.provider.createAgent({ userId: 'u', name: 'n' })).rejects.toThrow();
    const t2 = setup();
    t2.receipts.set(hash(1001), { ...success(1001), status: 'reverted' });
    await expect(t2.provider.createAgent({ userId: 'u', name: 'n' })).rejects.toBeInstanceOf(
      AppError,
    );
  });
});

describe('owner work through the operator', () => {
  it('setTransferLimit writes abi.encode(uint256) under "TransferLimit" for the 8004 id', async () => {
    const t = setup();
    t.receipts.set(hash(1001), success(1001));
    const h = await t.provider.setTransferLimit(t.agent, W(10_000n));
    expect(h).toBe(hash(1001));
    const call = decodeFunctionData({
      abi: identityRegistryAbi,
      data: t.operatorSends[0]?.data ?? '0x',
    });
    expect(call.functionName).toBe('setMetadata');
    expect(call.args).toEqual([
      31_312n,
      'TransferLimit',
      encodeAbiParameters([{ type: 'uint256' }], [W(10_000n)]),
    ]);
    expect(t.operatorSends[0]?.to).toBe(REGISTRY);
  });

  it('setTransferLimit refuses zero and an agent that has no 8004 id', async () => {
    const t = setup();
    await expect(t.provider.setTransferLimit(t.agent, 0n)).rejects.toBeInstanceOf(AppError);
    const { onchainAgentId: _id, ...noId } = t.agent;
    await expect(t.provider.setTransferLimit(noId, 1n)).rejects.toBeInstanceOf(AppError);
    expect(t.operatorSends).toHaveLength(0);
  });

  it('bindAgent, freeze and unfreeze call the orders proxy as the operator', async () => {
    const t = setup();
    for (const n of [1001, 1002, 1003]) t.receipts.set(hash(n), success(n));
    await t.provider.bindAgent(t.agent);
    expect(await t.provider.freeze(t.agent)).toEqual([hash(1002)]);
    expect(await t.provider.unfreeze(t.agent)).toEqual([hash(1003)]);
    const calls = t.operatorSends.map((s) => {
      expect(s.to).toBe(PROXY);
      const d = decodeFunctionData({ abi: ordersAbi, data: s.data ?? '0x' });
      return [d.functionName, d.args];
    });
    expect(calls).toEqual([
      ['bindAgent', [getAddress(t.agent.address)]],
      ['setAgentPaused', [getAddress(t.agent.address), true]],
      ['setAgentPaused', [getAddress(t.agent.address), false]],
    ]);
  });

  it('fund is a plain transfer to the agent wallet, never to anyone else', async () => {
    const t = setup();
    t.receipts.set(hash(1001), success(1001));
    await t.provider.fund(t.agent, W(12_000n));
    expect(t.operatorSends).toEqual([{ to: t.agent.address, value: W(12_000n) }]);
    await expect(t.provider.fund(t.agent, 0n)).rejects.toBeInstanceOf(AppError);
  });

  it('a revert on chain is an error, not a success', async () => {
    const t = setup();
    t.receipts.set(hash(1001), { ...success(1001), status: 'reverted' });
    await expect(t.provider.bindAgent(t.agent)).rejects.toBeInstanceOf(AppError);
  });

  it('operator writes are serialized: the second waits for the first receipt', async () => {
    const t = setup();
    const order: string[] = [];
    let release: () => void = () => undefined;
    t.pub.waitForTransactionReceipt.mockImplementation(({ hash: h }: { hash: Hex }) => {
      order.push(`wait:${h.slice(-4)}`);
      return new Promise<ReceiptLike>((resolve) => {
        const done = () => {
          resolve(success(1));
        };
        if (h === hash(1001)) release = done;
        else done();
      });
    });
    t.operatorWallet.sendTransaction = vi.fn((tx: { to: Hex; data?: Hex; value?: bigint }) => {
      t.operatorSends.push(tx);
      order.push(`send:${String(t.operatorSends.length)}`);
      return Promise.resolve(hash(1000 + t.operatorSends.length));
    });
    const a = t.provider.bindAgent(t.agent);
    const b = t.provider.freeze(t.agent);
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual(['send:1', `wait:${hash(1001).slice(-4)}`]);
    release();
    await Promise.all([a, b]);
    expect(order.filter((o) => o.startsWith('send'))).toEqual(['send:1', 'send:2']);
  });
});

describe('drain', () => {
  it('sends the balance minus the worst-case fee to the owner, from the agent key', async () => {
    const t = setup({ balance: 1_000_000n });
    t.pub.sendRawTransaction.mockResolvedValue(hash(2001));
    t.receipts.set(hash(2001), success(2001));
    const out = await t.provider.drain(t.agent);
    expect(out).toEqual([hash(2001)]);
    // 21,000 gas at 10 aokrw per gas = 210,000 of fee.
    const lastPrepare = t.agentWallet.prepareTransactionRequest.mock.calls.at(-1)?.[0];
    expect(lastPrepare).toMatchObject({ to: OPERATOR.address, value: 1_000_000n - 210_000n });
  });

  it('pays a pouch-style owner that is not the operator, signed by the agent, to nobody else', async () => {
    const t = setup({ balance: 1_000_000n });
    const pouch: Hex = '0x000000000000000000000000000000000a0b0c0d';
    const agent: AgentWallet = { ...t.agent, ownerAddress: pouch };
    t.pub.sendRawTransaction.mockResolvedValue(hash(2002));
    t.receipts.set(hash(2002), success(2002));
    const signers: string[] = [];
    const prepared: { to?: Hex }[] = [];
    t.agentWallet.prepareTransactionRequest.mockImplementation((a) => {
      prepared.push(a as { to?: Hex });
      return Promise.resolve({ ...a, gas: 21_000n, maxFeePerGas: 10n });
    });
    t.agentWallet.signTransaction.mockImplementation(() => {
      signers.push('agent');
      return Promise.resolve('0x02f8abcdef' as Hex);
    });
    await t.provider.drain(agent);
    expect(prepared.length).toBeGreaterThan(0);
    for (const p of prepared) expect(p.to).toBe(pouch);
    expect(prepared.some((p) => p.to === OPERATOR.address)).toBe(false);
    expect(signers).toEqual(['agent']);
    expect(t.walletAccounts).toEqual([agent.address.toLowerCase()]);
    expect(t.operatorSends).toEqual([]);
  });

  it('has nothing to send when the balance cannot pay its own fee', async () => {
    const t = setup({ balance: 100n });
    expect(await t.provider.drain(t.agent)).toEqual([]);
    expect(t.pub.sendRawTransaction).not.toHaveBeenCalled();
  });

  it('has nothing to send at zero balance and never prices a transfer (estimate would fail)', async () => {
    const t = setup({ balance: 0n });
    t.agentWallet.prepareTransactionRequest.mockRejectedValue(new Error('insufficient funds'));
    expect(await t.provider.drain(t.agent)).toEqual([]);
    expect(t.agentWallet.prepareTransactionRequest).not.toHaveBeenCalled();
    expect(t.pub.sendRawTransaction).not.toHaveBeenCalled();
  });

  it('balanceOf reads the chain', async () => {
    const t = setup({ balance: 42n });
    expect(await t.provider.balanceOf(t.agent.address)).toBe(42n);
  });
});

describe('preflight', () => {
  it('a wallet below the amount is CHAIN_INSUFFICIENT_FUNDS before any simulation', async () => {
    const t = setup({ balance: W(1_000n) });
    expect(await t.provider.preflight(t.req())).toEqual({
      ok: false,
      error: { code: 'CHAIN_INSUFFICIENT_FUNDS' },
    });
    expect(t.pub.pcl.simulatePclProxy).not.toHaveBeenCalled();
  });

  it('simulates placeOrder as the agent with the amount as value', async () => {
    const t = setup();
    expect(await t.provider.preflight(t.req())).toEqual({ ok: true });
    expect(t.pub.pcl.simulatePclProxy).toHaveBeenCalledWith(
      expect.objectContaining({
        account: t.agent.address,
        address: PROXY,
        functionName: 'placeOrder',
        args: [1n, REF],
        value: W(9_000n),
      }),
    );
  });

  it.each([
    [
      'ExceededAgentTransferLimit',
      [W(5_000n), W(9_000n)],
      { code: 'CHAIN_AGENT_LIMIT', params: { max: '5,000원' } },
    ],
    ['AgentTransferLimitMetadataInvalid', ['unset'], { code: 'CHAIN_AGENT_LIMIT_UNSET' }],
    ['AgentIsPaused', undefined, { code: 'CHAIN_AGENT_PAUSED' }],
    ['MerchantNotActive', [1n], { code: 'CHAIN_MERCHANT_INACTIVE' }],
    ['AgentNotBound', undefined, { code: 'INTERNAL' }],
    ['OrderExists', [REF], { code: 'INTERNAL' }],
  ] as const)('a simulated %s is decoded to its code', async (name, args, expected) => {
    const t = setup();
    t.pub.pcl.simulatePclProxy.mockResolvedValue({
      status: 'reverted',
      error: reverted(revertData(name, args)),
      revert: null,
    });
    expect(await t.provider.preflight(t.req())).toEqual({ ok: false, error: expected });
  });

  it('a 30-day refusal carries resetAt', async () => {
    const t = setup();
    const resetAt = BigInt(Date.parse('2026-12-01T03:00:00Z') / 1000);
    t.pub.pcl.simulatePclProxy.mockResolvedValue({
      status: 'reverted',
      error: reverted(revertData('ExceededPeriodicVolume', [W(60_000n), W(61_000n), resetAt])),
      revert: null,
    });
    const r = await t.provider.preflight(t.req());
    expect(r).toMatchObject({ ok: false, error: { code: 'CHAIN_PERIODIC_LIMIT' } });
    expect(r.ok ? '' : r.error.params?.['resetAt']).toContain('12월 1일');
  });

  it('uses the decoded revert when there are no raw bytes', async () => {
    const t = setup();
    t.pub.pcl.simulatePclProxy.mockResolvedValue({
      status: 'reverted',
      error: new Error('x'),
      revert: { errorName: 'Unauthorized' },
    });
    expect(await t.provider.preflight(t.req())).toEqual({
      ok: false,
      error: { code: 'CHAIN_UNAUTHORIZED' },
    });
  });
});

describe('pay', () => {
  const okReceipt = (blockNumber = 555n) => success(9, [placedLog(REF)], blockNumber);

  it('signs, hands hash and nonce to the caller, only then broadcasts, and returns the mined hash', async () => {
    const t = setup();
    const signedHash = keccak256('0x02f8abcdef');
    t.receipts.set(signedHash, okReceipt());
    const seen: { txHash: Hex; nonce: number }[] = [];
    const r = await t.provider.pay({
      ...t.req(),
      beforeBroadcast: (s) => {
        t.calls.push('saved');
        seen.push(s);
      },
    });
    expect(r).toEqual({ ok: true, txHash: signedHash, blockNumber: 555n });
    expect(seen).toEqual([{ txHash: signedHash, nonce: 3 }]);
    // Order of effects: sign, save the marker, broadcast.
    expect(t.calls).toEqual(['sign', 'saved', 'broadcast']);
    // The agent is the sender; the gas limit is the estimate, not a fixed number.
    expect(t.pub.estimateGas).toHaveBeenCalledWith(
      expect.objectContaining({
        account: getAddress(t.agent.address),
        to: PROXY,
        value: W(9_000n),
      }),
    );
    expect(t.agentWallet.prepareTransactionRequest).toHaveBeenCalledWith(
      expect.objectContaining({ to: PROXY, nonce: 3, gas: 150_000n, value: W(9_000n) }),
    );
    const data = t.agentWallet.prepareTransactionRequest.mock.calls[0] as unknown as [
      { data: Hex },
    ];
    expect(decodeFunctionData({ abi: ordersAbi, data: data[0].data })).toMatchObject({
      functionName: 'placeOrder',
      args: [1n, REF],
    });
  });

  it('a refused estimate is returned as a decoded refusal with nothing signed or sent', async () => {
    const t = setup();
    t.pub.estimateGas.mockRejectedValue(
      reverted(revertData('ExceededAgentTransferLimit', [W(5_000n), W(9_000n)])),
    );
    const r = await t.provider.pay(t.req());
    expect(r).toEqual({
      ok: false,
      stage: 'preflight',
      error: { code: 'CHAIN_AGENT_LIMIT', params: { max: '5,000원' } },
    });
    expect(t.agentWallet.signTransaction).not.toHaveBeenCalled();
    expect(t.pub.sendRawTransaction).not.toHaveBeenCalled();
  });

  it('an estimate that fails for an unknown reason throws and signs nothing', async () => {
    const t = setup();
    t.pub.estimateGas.mockRejectedValue(new Error('rpc down'));
    await expect(t.provider.pay(t.req())).rejects.toBeInstanceOf(AppError);
    expect(t.agentWallet.signTransaction).not.toHaveBeenCalled();
  });

  it('if the caller cannot save the marker, nothing is broadcast', async () => {
    const t = setup();
    const err = new AppError('INTERNAL', { reason: 'order left submitting' });
    await expect(
      t.provider.pay({
        ...t.req(),
        beforeBroadcast: () => {
          throw err;
        },
      }),
    ).rejects.toBe(err);
    expect(t.pub.sendRawTransaction).not.toHaveBeenCalled();
  });

  it('a node that refuses for lack of funds is a submit-stage refusal (no gas spent)', async () => {
    const t = setup();
    t.pub.sendRawTransaction.mockRejectedValue(
      Object.assign(new Error('rpc'), { cause: new Error('insufficient funds for gas') }),
    );
    expect(await t.provider.pay(t.req())).toEqual({
      ok: false,
      stage: 'submit',
      error: { code: 'CHAIN_INSUFFICIENT_FUNDS' },
    });
  });

  it('any other broadcast failure is an unknown result: thrown, tried once, never retried', async () => {
    const t = setup();
    t.pub.sendRawTransaction.mockRejectedValue(new Error('socket hang up'));
    const err = await t.provider.pay(t.req()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(t.pub.sendRawTransaction).toHaveBeenCalledTimes(1);
    expect(JSON.stringify((err as AppError).detail)).toContain(keccak256('0x02f8abcdef'));
  });

  it('a receipt that never comes is an unknown result with the hash kept', async () => {
    const t = setup();
    t.receipts.set(keccak256('0x02f8abcdef'), new Error('timed out'));
    const err = await t.provider.pay(t.req()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(t.pub.sendRawTransaction).toHaveBeenCalledTimes(1);
  });

  it('a reverted receipt is replayed at its block and decoded, with the tx hash', async () => {
    const t = setup();
    const signedHash = keccak256('0x02f8abcdef');
    t.receipts.set(signedHash, { ...success(9, [], 777n), status: 'reverted' });
    t.pub.call.mockRejectedValue(
      reverted(revertData('ExceededAgentTransferLimit', [W(5_000n), W(9_000n)])),
    );
    const r = await t.provider.pay(t.req());
    expect(r).toEqual({
      ok: false,
      stage: 'execution',
      error: { code: 'CHAIN_AGENT_LIMIT', params: { max: '5,000원' } },
      txHash: signedHash,
    });
    expect(t.pub.call).toHaveBeenCalledWith(expect.objectContaining({ blockNumber: 777n }));
  });

  it('a reverted receipt whose reason cannot be read is INTERNAL (still with the tx hash)', async () => {
    const t = setup();
    t.receipts.set(keccak256('0x02f8abcdef'), { ...success(9), status: 'reverted' });
    const r = await t.provider.pay(t.req());
    expect(r).toMatchObject({ ok: false, stage: 'execution', error: { code: 'INTERNAL' } });
  });

  it('a successful receipt without OrderPlaced for this orderRef is not a payment', async () => {
    const t = setup();
    t.receipts.set(keccak256('0x02f8abcdef'), success(9, [placedLog(`0x${'cd'.repeat(32)}`)]));
    await expect(t.provider.pay(t.req())).rejects.toBeInstanceOf(AppError);
  });

  it('two payments for one agent never share a nonce read', async () => {
    const t = setup();
    const order: string[] = [];
    t.pub.getTransactionCount.mockImplementation(() => {
      order.push('nonce');
      return Promise.resolve(order.filter((o) => o === 'nonce').length);
    });
    t.pub.sendRawTransaction.mockImplementation(() => {
      order.push('broadcast');
      return Promise.resolve(hash(0));
    });
    t.receipts.set(keccak256('0x02f8abcdef'), success(9, [placedLog(REF)]));
    await Promise.all([t.provider.pay(t.req()), t.provider.pay(t.req())]);
    expect(order).toEqual(['nonce', 'broadcast', 'nonce', 'broadcast']);
  });

  it('refuses an agent whose key the vault does not hold', async () => {
    const t = setup();
    await expect(
      t.provider.pay({
        ...t.req(),
        agent: { ...t.agent, address: '0x0000000000000000000000000000000000000001' },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('findPaid', () => {
  it('asks for OrderPlaced(orderRef) from the deploy block', async () => {
    const t = setup();
    t.pub.getLogs.mockResolvedValue([{ transactionHash: hash(5), blockNumber: 12n }]);
    expect(await t.provider.findPaid(REF)).toEqual({ txHash: hash(5), blockNumber: 12n });
    expect(t.pub.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        address: PROXY,
        args: { orderRef: REF },
        fromBlock: 23_000_000n,
        toBlock: 'latest',
      }),
    );
  });

  it('is null when no such event exists', async () => {
    const t = setup();
    expect(await t.provider.findPaid(REF)).toBeNull();
  });
});

describe('receiptOf', () => {
  it('is success for a mined, executed transaction', async () => {
    const t = setup();
    t.receipts.set(hash(7), success(7, [], 55n));
    expect(await t.provider.receiptOf(hash(7))).toEqual({ status: 'success', blockNumber: 55n });
  });

  it('is unknown when there is no receipt', async () => {
    const t = setup();
    expect(await t.provider.receiptOf(hash(8))).toEqual({ status: 'unknown' });
  });

  it('throws (never a guess) when the chain cannot be read', async () => {
    const t = setup();
    t.pub.getTransactionReceipt.mockRejectedValue(new Error('rpc down'));
    await expect(t.provider.receiptOf(hash(8))).rejects.toBeInstanceOf(AppError);
  });

  it('decodes a reverted receipt by replaying the recorded call at its block', async () => {
    const t = setup();
    t.receipts.set(hash(9), { ...success(9, [], 777n), status: 'reverted' });
    t.pub.call.mockRejectedValue(
      reverted(revertData('ExceededAgentTransferLimit', [W(5_000n), W(9_000n)])),
    );
    expect(await t.provider.receiptOf(hash(9))).toEqual({
      status: 'reverted',
      blockNumber: 777n,
      error: { code: 'CHAIN_AGENT_LIMIT', params: { max: '5,000원' } },
    });
    expect(t.pub.call).toHaveBeenCalledWith(
      expect.objectContaining({ blockNumber: 777n, data: '0xabcd', value: 9n }),
    );
  });

  it('a reverted receipt whose reason cannot be read is INTERNAL', async () => {
    const t = setup();
    t.receipts.set(hash(9), { ...success(9), status: 'reverted' });
    t.pub.getTransaction.mockRejectedValue(new Error('gone'));
    expect(await t.provider.receiptOf(hash(9))).toMatchObject({
      status: 'reverted',
      error: { code: 'INTERNAL' },
    });
  });
});

describe('shape', () => {
  it('is path B and reports the gas share the orders top-up must add', () => {
    const t = setup();
    expect(t.provider.path).toBe('B');
    expect(t.provider.gasReserveAokrw).toBe(W(100n));
  });
});
