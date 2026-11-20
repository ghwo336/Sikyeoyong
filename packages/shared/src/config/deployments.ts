import { z } from 'zod';
import { AppError } from '../errors/index.js';
import { isPolicyProfile, type PolicyProfile } from './policy.js';

/**
 * Deployment records (`deployments/<chainId>.<profile>.json`, CLAUDE.md rule 2). The deploy CLI
 * (infra/scripts/deploy-orders.ts) writes one per chain and profile; the API reads the proxy
 * address from here. This module only parses and looks up. It reads no files and no environment.
 */
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const txHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const blockNumber = z.number().int().nonnegative();

const policyChild = z.object({
  template: z.string().min(1),
  /** Decoded values as text (amounts in aokrw strings), for reading only. */
  value: z.record(z.string(), z.string()),
});

const policySummary = z.object({
  selector: z.string().regex(/^0x[0-9a-f]{8}$/),
  signature: z.string().min(1),
  /** The root template, for example LOGICAL_POLICY. */
  root: z.string().min(1),
  quantifier: z.string().optional(),
  children: z.array(policyChild),
});

export const deploymentSchema = z.object({
  chainId: z.number().int().positive(),
  profile: z.string().refine(isPolicyProfile, 'unknown profile'),
  /** UTC date of the deployment, YYYY-MM-DD. */
  deployedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  operator: address,
  implementation: address,
  proxy: address,
  /** Block of the proxy deployment. The indexer starts here. */
  deployBlock: blockNumber,
  txs: z.object({ implementation: txHash, proxy: txHash, policies: txHash }),
  blocks: z.object({ implementation: blockNumber, proxy: blockNumber, policies: blockNumber }),
  /** keccak256 of the policies read back from the chain, see infra deploy-orders. */
  policyHash: z.string().regex(/^0x[0-9a-f]{64}$/),
  policies: z.array(policySummary),
});

export type DeploymentRecord = Omit<z.infer<typeof deploymentSchema>, 'profile'> & {
  readonly profile: PolicyProfile;
};

/** Validates one record. A malformed record fails loudly: a wrong proxy address must not pass. */
export function parseDeployment(raw: unknown): DeploymentRecord {
  const parsed = deploymentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError('INTERNAL', {
      reason: 'invalid deployment record',
      issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    });
  }
  return parsed.data;
}

export function findDeployment(
  records: readonly DeploymentRecord[],
  chainId: number,
  profile: PolicyProfile,
): DeploymentRecord | null {
  return records.find((r) => r.chainId === chainId && r.profile === profile) ?? null;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * The orders proxy address for a chain and profile. `override` is the ORDERS_CONTRACT env value
 * (tech-spec 8.3): when set it wins, so a staging proxy can be tried without a record. Without
 * either this throws, so a screen never runs against an address nobody deployed.
 */
export function resolveOrdersContract(
  records: readonly DeploymentRecord[],
  chainId: number,
  profile: PolicyProfile,
  override?: string,
): `0x${string}` {
  if (override !== undefined && override !== '') {
    if (!ADDRESS_RE.test(override)) {
      throw new AppError('INTERNAL', { reason: 'invalid ORDERS_CONTRACT override' });
    }
    return override as `0x${string}`;
  }
  const found = findDeployment(records, chainId, profile);
  if (found === null) {
    throw new AppError('INTERNAL', { reason: 'no deployment record', chainId, profile });
  }
  return found.proxy as `0x${string}`;
}
