import { z } from 'zod';
import { zAokrwString } from '../money/money.js';
import { zOrderQuote, zOrderStatus } from './orders.js';

const id = z.string().min(1).max(64);

export const APPROVAL_REASONS = [
  'OVER_LEVEL_LIMIT',
  'NEW_MERCHANT',
  'OVER_PERSONAL_BUDGET',
] as const;
export const zApprovalReason = z.enum(APPROVAL_REASONS);
export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'expired'] as const;
export const zApprovalStatus = z.enum(APPROVAL_STATUSES);

/** One owner approval waiting on an order (GET /approvals, tech-spec 3.2). */
export const zApprovalView = z
  .object({
    id,
    orderId: id,
    reason: zApprovalReason,
    store: z.string().min(1),
    amount: zAokrwString,
    /** unix ms */
    expiresAt: z.number().int().nonnegative(),
  })
  .strict();
export type ApprovalView = z.infer<typeof zApprovalView>;

export const zApprovalList = z.object({ approvals: z.array(zApprovalView) }).strict();
export type ApprovalList = z.infer<typeof zApprovalList>;

/** GET /approvals query: only pending is listed (tech-spec 3.2 `?status=pending`). */
export const zApprovalListQuery = z.object({ status: z.literal('pending').optional() }).strict();

/** :id of /approvals/:id routes. */
export const zApprovalIdParam = id;

/**
 * POST /approvals/:id/approve and /reject. Approving never pays (D-19): the order
 * goes back to quoted and comes with its confirm card; paying is that card's button.
 */
export const zApprovalDecision = z
  .object({
    approval: z.object({ id, status: zApprovalStatus }).strict(),
    order: z.object({ id, status: zOrderStatus }).strict(),
    quote: zOrderQuote.optional(),
  })
  .strict();
export type ApprovalDecision = z.infer<typeof zApprovalDecision>;
