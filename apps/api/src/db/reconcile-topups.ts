import { and, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import type { Db } from './client.js';
import { ownerAllowanceEntries } from './schema/index.js';

/** A fund entry of the owner allowance (the columns the reconciliation reads). */
export type AllowanceEntry = typeof ownerAllowanceEntries.$inferSelect;

/** The two things the reconciliation touches (a fake in tests, the repositories in the CLI). */
export interface ReconcilePorts {
  /** Fund holds with no hash, reserved before beforeMs. */
  holdsBefore(beforeMs: number): readonly AllowanceEntry[];
  /** Deletes the hold only while it has no hash. Returns whether it was deleted. */
  release(holdId: string): boolean;
}

export interface Ambiguous {
  readonly holdId: string;
  readonly userId: string;
  readonly amountAokrw: string;
  /** The order the hold was reserved for, null on holds from before migration 0016. */
  readonly orderId: string | null;
  readonly reason: 'no-order-link' | 'fund-call-started';
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
 * Looks at fund holds that stayed without a hash (payment.md "즉시 충전(fund)의 멱등성"). Each hold
 * carries its own permanent evidence: the order it was reserved for and the time the fund call
 * was about to start (set by topUp after the order's marker, right before the call, never
 * undone). Released only a hold with an order link and no call start: it never reached the call,
 * so nothing was sent. Everything else is reported, never released, never re-sent (CLAUDE.md rule
 * 9): a hold whose call started may have moved money (the call threw, the answer was lost, or
 * only the ledger write failed), and a hold without the link (rows from before the column) has no
 * evidence either way. The order's own marker is not consulted: a later attempt overwrites or
 * clears it. Holds younger than olderThanMs are skipped, so a top-up in flight is never judged.
 */
export function reconcileTopups(
  ports: ReconcilePorts,
  opts: { readonly dryRun: boolean; readonly olderThanMs: number; readonly nowMs: number },
): ReconcileReport {
  const holds = ports.holdsBefore(opts.nowMs - opts.olderThanMs);
  const released: string[] = [];
  const ambiguous: Ambiguous[] = [];
  for (const hold of holds) {
    const orderId = hold.orderId ?? null;
    const reason =
      orderId === null
        ? 'no-order-link'
        : hold.fundCallStartedAt != null
          ? 'fund-call-started'
          : null;
    if (reason === null) {
      if (opts.dryRun || ports.release(hold.id)) released.push(hold.id);
      continue;
    }
    ambiguous.push({
      holdId: hold.id,
      userId: hold.userId,
      amountAokrw: hold.amountAokrw,
      orderId,
      reason,
    });
  }
  return { checked: holds.length, released, ambiguous };
}

/**
 * The ports on the real tables. This lives in db/ (like merchant-onchain-sync) because it reads
 * the allowance table for an owner-run script outside any module.
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
    release: (id) =>
      db
        .delete(ownerAllowanceEntries)
        .where(
          and(
            eq(ownerAllowanceEntries.id, id),
            eq(ownerAllowanceEntries.kind, 'fund'),
            isNull(ownerAllowanceEntries.txHash),
            isNull(ownerAllowanceEntries.fundCallStartedAt),
            isNotNull(ownerAllowanceEntries.orderId),
          ),
        )
        .run().changes === 1,
  };
}
