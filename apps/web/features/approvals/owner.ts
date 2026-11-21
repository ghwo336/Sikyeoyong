import type { ApprovalView } from '../../lib/api';

/** The reasons the owner's yes answers (the ui card draws these two). */
export type OwnerReason = 'NEW_MERCHANT' | 'OVER_PERSONAL_BUDGET';
export type OwnerApproval = ApprovalView & { readonly reason: OwnerReason };

/**
 * The owner cards to draw: an approval gets its card only while its order is still waiting for
 * the owner (`pending_approval` in the orders list). The chat and the order history both use this,
 * so they never disagree about which cards exist.
 */
export function cardsToShow(
  approvals: readonly OwnerApproval[],
  orders: readonly { readonly id: string; readonly status: string }[] | undefined,
): OwnerApproval[] {
  const waiting = new Set(
    (orders ?? []).filter((o) => o.status === 'pending_approval').map((o) => o.id),
  );
  return approvals.filter((a) => waiting.has(a.orderId));
}

/**
 * GET /approvals also lists a wait on the per-order limit (OVER_LEVEL_LIMIT), but that one is
 * not answered by a yes: the server refuses it (400) and the way out is the limit screens
 * (Blocked, raise). So only a new store and the 30-day limit become owner cards.
 */
export function ownerApprovals(approvals: readonly ApprovalView[]): OwnerApproval[] {
  return approvals.filter(
    (a): a is OwnerApproval => a.reason === 'NEW_MERCHANT' || a.reason === 'OVER_PERSONAL_BUDGET',
  );
}
