import { aokrwToString } from '@sikyeoyong/shared';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ORDER_EVENTS, type OrderEventsReader, type PlacedLog } from '../chain/chain.service.js';
import { MerchantsService } from '../merchants/merchants.service.js';
import { OrdersRepository } from './orders.repository.js';

/** How often the chain is asked for new blocks. */
export const INDEXER_INTERVAL_MS = 3_000;
/** The most blocks one getLogs call covers (RPCs cap the range). */
export const INDEXER_CHUNK_BLOCKS = 2_000n;

/**
 * The indexer (payment.md "submitting을 끝내는 규칙": "인덱서가 OrderPlaced(orderRef)를 보면
 * paid"). A small poller: from the deployment block it reads the proxy's OrderPlaced logs in
 * chunks and confirms the matching order as paid. It only reads the chain and never pays
 * (CLAUDE.md rule 9).
 *  - idempotent: a log for an order that is already paid changes nothing, and a chain event is
 *    written once per (tx_hash, log_index). Reading the same blocks again is harmless.
 *  - an orderRef we do not know is logged and ignored. A log whose amount or merchant differs from
 *    the order's is logged as an error and never marks it paid.
 *  - only `submitting` and `failed` orders are confirmed (a retryable failed order whose first
 *    transaction landed late is paid after all). A log for an order that never began paying is
 *    logged, not trusted.
 * The mock path and a setup without a deployed proxy have no reader: nothing starts.
 * The cursor (the last applied block per chain and contract) is stored after every chunk
 * (`indexer_cursors`, migration 0014). A restart resumes after it, else at the deployment block.
 */
@Injectable()
export class OrderIndexer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OrderIndexer.name);
  private timer: NodeJS.Timeout | null = null;
  private cursor: bigint | null = null;
  private ticking = false;

  constructor(
    @Inject(ORDER_EVENTS) private readonly reader: OrderEventsReader | null,
    private readonly repo: OrdersRepository,
    private readonly merchants: MerchantsService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.reader === null) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, INDEXER_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** One poll: every chunk up to the chain's latest block. Never throws; a failure is retried next tick. */
  async tick(nowMs: number = Date.now()): Promise<number> {
    const reader = this.reader;
    if (reader === null || this.ticking) return 0;
    this.ticking = true;
    let confirmed = 0;
    try {
      const latest = await reader.latestBlock();
      // The first poll resumes after the stored block; with none, or one behind the deployment
      // block (a different deployment), it starts at the deployment block.
      if (this.cursor === null) {
        const saved = this.repo.indexerCursor(reader.chainId, reader.contract);
        this.cursor =
          saved !== null && saved + 1n > reader.startBlock ? saved + 1n : reader.startBlock;
      }
      let from = this.cursor;
      while (from <= latest) {
        const to =
          from + INDEXER_CHUNK_BLOCKS - 1n < latest ? from + INDEXER_CHUNK_BLOCKS - 1n : latest;
        for (const log of await reader.orderPlaced(from, to)) {
          if (this.apply(log, nowMs)) confirmed += 1;
        }
        // The cursor moves only after the whole chunk was applied, and is stored with it.
        this.repo.saveIndexerCursor(reader.chainId, reader.contract, to, nowMs);
        from = to + 1n;
        this.cursor = from;
      }
    } catch (e) {
      this.logger.warn(`indexer poll failed, will retry (${(e as Error).name})`);
    } finally {
      this.ticking = false;
    }
    return confirmed;
  }

  private matches(
    row: { id: string; merchantId: string; amountAokrw: string },
    log: PlacedLog,
  ): boolean {
    const onchainId = this.merchants.orderInfoOf(row.merchantId)?.onchainId ?? null;
    const amountOk = aokrwToString(log.amount) === row.amountAokrw;
    const merchantOk = onchainId !== null && onchainId === log.merchantId;
    if (amountOk && merchantOk) return true;
    this.logger.error(
      `OrderPlaced for order ${row.id} does not match it (tx ${log.txHash}): ` +
        `amount ${aokrwToString(log.amount)} vs ${row.amountAokrw}, ` +
        `merchant ${log.merchantId.toString()} vs ${onchainId?.toString() ?? 'none'}. Not marked paid`,
    );
    return false;
  }

  private apply(log: PlacedLog, nowMs: number): boolean {
    const row = this.repo.findByOrderRef(log.orderRef);
    if (row === undefined) {
      this.logger.warn(
        `OrderPlaced for an unknown orderRef ${log.orderRef} (tx ${log.txHash}), ignored`,
      );
      return false;
    }
    this.repo.recordChainEvent(
      row.id,
      'OrderPlaced',
      log.txHash,
      log.logIndex,
      { blockNumber: log.blockNumber.toString() },
      nowMs,
    );
    // The chain's merchant and amount must be the order's own. If not, the log is not this order
    // being paid: no paid, only an error log (a person looks).
    if (!this.matches(row, log)) return false;
    if (row.status !== 'submitting' && row.status !== 'failed') {
      if (row.status === 'quoted' || row.status === 'pending_approval') {
        this.logger.error(
          `OrderPlaced for order ${row.id} that never began paying (${row.status}), tx ${log.txHash}`,
        );
      }
      return false;
    }
    return this.repo.transition(
      row.id,
      row.status,
      { status: 'paid', txHash: log.txHash, errorCode: null },
      nowMs,
    );
  }
}
