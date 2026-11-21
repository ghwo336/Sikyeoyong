import { AppError, type Hex, type PaymentProvider } from '@sikyeoyong/shared';
import { createMarooPublicClient } from '../../common/onchain/clients.js';
import { ordersAbi } from '../../common/onchain/orders-abi.js';
import { resolveOrdersTarget } from '../../common/onchain/orders-target.js';
import type { AppConfig } from '../../config/env.js';
import type { OrderEventsReader, PlacedLog } from './chain.service.js';

/** The slice of a viem public client the reader uses (a port, so tests need no network). */
export interface LogsPort {
  getBlockNumber(): Promise<bigint>;
  getLogs(a: { address: Hex; event: unknown; fromBlock: bigint; toBlock: bigint }): Promise<
    readonly {
      transactionHash: Hex | null;
      logIndex: number | null;
      blockNumber: bigint | null;
      args?: unknown;
    }[]
  >;
}

const ORDER_PLACED = ordersAbi.find((i) => i.type === 'event' && i.name === 'OrderPlaced');

export function createOrderEventsReader(
  chainId: number,
  proxy: Hex,
  startBlock: bigint,
  port: LogsPort,
): OrderEventsReader {
  return {
    chainId,
    contract: proxy,
    startBlock,
    latestBlock: () => port.getBlockNumber(),
    async orderPlaced(from, to) {
      const logs = await port.getLogs({
        address: proxy,
        event: ORDER_PLACED,
        fromBlock: from,
        toBlock: to,
      });
      const out: PlacedLog[] = [];
      for (const l of logs) {
        const args = l.args as { orderRef?: Hex; merchantId?: bigint; amount?: bigint } | undefined;
        const orderRef = args?.orderRef;
        if (
          orderRef === undefined ||
          args?.merchantId === undefined ||
          args.amount === undefined ||
          l.transactionHash === null ||
          l.logIndex === null ||
          l.blockNumber === null
        ) {
          continue; // a pending or malformed log is not a confirmed order
        }
        out.push({
          orderRef,
          txHash: l.transactionHash,
          logIndex: l.logIndex,
          blockNumber: l.blockNumber,
          merchantId: args.merchantId,
          amount: args.amount,
        });
      }
      return out;
    },
  };
}

/**
 * Only path B has a real chain to read. The mock path (and a dev setup without a deployed proxy)
 * has no indexer: null. Production without a proxy stops the boot like the payment provider does.
 */
export function createOrderEvents(
  config: AppConfig,
  payment: PaymentProvider,
  port?: LogsPort,
): OrderEventsReader | null {
  if (payment.path !== 'B') return null;
  try {
    const target = resolveOrdersTarget(config);
    return createOrderEventsReader(
      config.chain.chainId,
      target.proxy,
      target.deployBlock,
      port ?? (createMarooPublicClient(config.chain) as unknown as LogsPort),
    );
  } catch (e) {
    if (config.nodeEnv === 'production' || !(e instanceof AppError)) throw e;
    return null;
  }
}
