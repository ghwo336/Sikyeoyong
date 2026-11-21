import type { ApprovalView } from '../../lib/api';

/** The reasons the owner's yes answers (the ui card draws these two). */
export type OwnerReason = 'NEW_MERCHANT' | 'OVER_PERSONAL_BUDGET';
export type OwnerApproval = ApprovalView & { readonly reason: OwnerReason };

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
