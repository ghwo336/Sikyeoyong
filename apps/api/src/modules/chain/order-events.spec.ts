import type { Hex, PaymentProvider } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../config/env.js';
import { createOrderEvents, createOrderEventsReader, type LogsPort } from './order-events.js';

const ref = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}`;
const hash = (n: number): Hex => `0x${n.toString(16).padStart(64, 'f')}`;

describe('createOrderEvents and the log reader', () => {
  const config = loadConfig({ PAYMENT_PATH: 'mock' });
  it('has no reader on the mock path', () => {
    expect(createOrderEvents(config, { path: 'mock' } as PaymentProvider)).toBeNull();
  });

  it('reads OrderPlaced args and skips a pending or malformed log', async () => {
    const port: LogsPort = {
      getBlockNumber: () => Promise.resolve(42n),
      getLogs: () =>
        Promise.resolve([
          {
            transactionHash: hash(1),
            logIndex: 3,
            blockNumber: 7n,
            args: { orderRef: ref(1), merchantId: 5n, amount: 9n },
          },
          {
            transactionHash: null,
            logIndex: null,
            blockNumber: null,
            args: { orderRef: ref(2), merchantId: 5n, amount: 9n },
          },
          // no merchant or amount: not an OrderPlaced we can judge
          { transactionHash: hash(4), logIndex: 1, blockNumber: 8n, args: { orderRef: ref(4) } },
          { transactionHash: hash(3), logIndex: 0, blockNumber: 8n, args: {} },
        ]),
    };
    const reader = createOrderEventsReader(1234, `0x${'11'.repeat(20)}`, 4n, port, 10_000n);
    expect(reader.startBlock).toBe(4n);
    expect(reader.chainId).toBe(1234);
    expect(reader.contract).toBe(`0x${'11'.repeat(20)}`);
    expect(await reader.latestBlock()).toBe(42n);
    expect(await reader.orderPlaced(0n, 10n)).toEqual([
      {
        orderRef: ref(1),
        txHash: hash(1),
        logIndex: 3,
        blockNumber: 7n,
        merchantId: 5n,
        amount: 9n,
      },
    ]);
  });

  it('splits a wide range so no getLogs call exceeds the span', async () => {
    const calls: { from: bigint; to: bigint }[] = [];
    const port: LogsPort = {
      getBlockNumber: () => Promise.resolve(0n),
      getLogs: ({ fromBlock, toBlock }) => {
        if (toBlock - fromBlock >= 10n) return Promise.reject(new Error('range too wide'));
        calls.push({ from: fromBlock, to: toBlock });
        return Promise.resolve([
          {
            transactionHash: hash(1),
            logIndex: 0,
            blockNumber: fromBlock,
            args: { orderRef: ref(1), merchantId: 1n, amount: 1n },
          },
        ]);
      },
    };
    const reader = createOrderEventsReader(1, `0x${'11'.repeat(20)}`, 0n, port, 10n);
    const logs = await reader.orderPlaced(0n, 24n);
    expect(calls).toEqual([
      { from: 0n, to: 9n },
      { from: 10n, to: 19n },
      { from: 20n, to: 24n },
    ]);
    expect(logs.map((l) => l.blockNumber)).toEqual([0n, 10n, 20n]);
  });
});
