import { type AgentLevel, getPolicy } from '@sikyeoyong/shared';

const LEVELS: readonly AgentLevel[] = [1, 2, 3];

/**
 * The lowest level whose per-order limit covers this amount (Blocked.dc.html "레벨 3으로
 * 올리고 시키기"), or undefined when even the top level does not.
 */
export function levelFor(amount: bigint): { level: AgentLevel; limit: bigint } | undefined {
  const policy = getPolicy('default');
  for (const level of LEVELS) {
    const limit = policy.perOrderLimitAokrw[level];
    if (amount <= limit) return { level, limit };
  }
  return undefined;
}
