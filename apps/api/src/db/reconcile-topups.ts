import { and, eq, isNull, lt } from 'drizzle-orm';
import type { Db } from './client.js';
import { orders, ownerAllowanceEntries } from './schema/index.js';

/** A fund entry of the owner allowance (the columns the reconciliation reads). */
export type AllowanceEntry = typeof ownerAllowanceEntries.$inferSelect;

/** What the orders table says about the top-up that a hold belongs to. */
export interface FundMarker {
  readonly orderId: string;
  readonly fundTxHash: string | null;
}

/** The three things the reconciliation touches (a fake in tests, the repositories in the CLI). */
export interface ReconcilePorts {
  /** Fund holds with no hash, reserved before beforeMs. */
  holdsBefore(beforeMs: number): readonly AllowanceEntry[];
  /** The order whose top-up marker matches the hold, or null when there is none. */
  markerOf(hold: AllowanceEntry): FundMarker | null;
  /** Deletes the hold only while it has no hash. Returns whether it was deleted. */
  release(holdId: string): boolean;
}

export interface Ambiguous {
  readonly holdId: string;
  readonly userId: string;
  readonly amountAokrw: string;
  readonly orderId: string;
  readonly reason: 'marker-without-hash' | 'order-has-hash';
}

export interface ReconcileReport {
  /** Holds old enough to look at. */
  readonly checked: number;
  /** Released (or, in a dry run, would be released): the top-up call was provably never made. */
  readonly released: readonly string[];
  /** Left alone: a top-up may have been broadcast, a person checks the chain. */
  readonly ambiguous: readonly Ambiguous[];
}

/**
 * Looks at fund holds that stayed without a hash (payment.md "즉시 충전(fund)의 멱등성"). A hold is
 * released only when no order has a top-up marker that matches it: topUp commits the marker
 * before the fund call, so no marker means the process died between reserving the allowance and
 * the call and nothing was sent. A marker without a hash (the call threw or the answer was lost)
 * and a marker with a hash (only the ledger write failed) both may have moved money: they are
 * reported, never released, never re-sent (CLAUDE.md rule 9). Fund holds record no nonce, so the
 * chain cannot prove a non-broadcast and is not consulted. Holds younger than olderThanMs are
 * skipped, so a top-up still in flight is never judged.
 */
export function reconcileTopups(
  ports: ReconcilePorts,
  opts: { readonly dryRun: boolean; readonly olderThanMs: number; readonly nowMs: number },
): ReconcileReport {
  const holds = ports.holdsBefore(opts.nowMs - opts.olderThanMs);
  const released: string[] = [];
  const ambiguous: Ambiguous[] = [];
  for (const hold of holds) {
    const marker = ports.markerOf(hold);
    if (marker === null) {
      if (opts.dryRun || ports.release(hold.id)) released.push(hold.id);
      continue;
    }
    ambiguous.push({
      holdId: hold.id,
      userId: hold.userId,
      amountAokrw: hold.amountAokrw,
      orderId: marker.orderId,
      reason: marker.fundTxHash === null ? 'marker-without-hash' : 'order-has-hash',
    });
  }
  return { checked: holds.length, released, ambiguous };
}

/**
 * The ports on the real tables. This lives in db/ (like merchant-onchain-sync) because it reads
 * two modules' tables for an owner-run script and no module may reach into the other's storage.
 */
export function dbPorts(db: Db): ReconcilePorts {
  return {
    holdsBefore: (beforeMs) =>
      db
        .select()
        .from(ownerAllowanceEntries)
        .where(
          and(
            eq(ownerAllowanceEntries.kind, 'fund'),
            isNull(ownerAllowanceEntries.txHash),
            lt(ownerAllowanceEntries.createdAt, beforeMs),
          ),
        )
        .all(),
    // topUp writes the marker and the hold with one clock: same user, start time and amount.
    markerOf: (hold) =>
      db
        .select({ orderId: orders.id, fundTxHash: orders.fundTxHash })
        .from(orders)
        .where(
          and(
            eq(orders.userId, hold.userId),
            eq(orders.fundStartedAt, hold.createdAt),
            eq(orders.fundAmountAokrw, hold.amountAokrw),
          ),
        )
        .get() ?? null,
    release: (id) =>
      db
        .delete(ownerAllowanceEntries)
        .where(
          and(
            eq(ownerAllowanceEntries.id, id),
            eq(ownerAllowanceEntries.kind, 'fund'),
            isNull(ownerAllowanceEntries.txHash),
          ),
        )
        .run().changes === 1,
  };
}
