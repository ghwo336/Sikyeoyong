import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RawPolicySet } from '@maroo-chain/viem';
import { formatEther, type Abi, type Hash, type Hex, type TransactionReceipt } from 'viem';
import { SpendGuard, worstCaseGas, type connect, type connectReadOnly } from './connect.ts';
import { REPO_ROOT, recordExists, recordPath } from './record.ts';
import type { PolicyProfile } from '@sikyeoyong/shared';

export type Connection = ReturnType<typeof connect>;
export type ReadConnection = Pick<ReturnType<typeof connectReadOnly>, 'publicClient'>;

/** Refuses to overwrite an existing deployment record unless force is set. */
export function assertNoRecord(chainId: number, profile: PolicyProfile, force: boolean): void {
  if (recordExists(chainId, profile) && !force) {
    throw new Error(`record exists: ${recordPath(chainId, profile)} (use --force to redeploy)`);
  }
}

/** Stops before any write when the RPC serves a different chain than the config. */
export async function assertChainId(
  client: { getChainId(): Promise<number> },
  expected: number,
): Promise<void> {
  const rpcChainId = await client.getChainId();
  if (rpcChainId !== expected) {
    throw new Error(`RPC chain id ${rpcChainId} differs from config ${expected}; nothing sent`);
  }
}

export interface Artifact {
  readonly abi: Abi;
  readonly bytecode: Hex;
}

/** forge build, then the abi and creation bytecode of SikyeoyongOrders. */
export function loadOrdersArtifact(skipBuild: boolean): Artifact {
  if (!skipBuild) {
    execFileSync('forge', ['build', '--root', join(REPO_ROOT, 'contracts')], { stdio: 'inherit' });
  }
  const path = join(REPO_ROOT, 'contracts', 'out', 'SikyeoyongOrders.sol', 'SikyeoyongOrders.json');
  const json = JSON.parse(readFileSync(path, 'utf8')) as { abi: Abi; bytecode: { object: Hex } };
  if (!/^0x[0-9a-fA-F]{100,}$/.test(json.bytecode.object))
    throw new Error('forge artifact has no bytecode');
  return { abi: json.abi, bytecode: json.bytecode.object };
}

export type Log = (line: string) => void;

/** What one write cost (balance drop) and where it landed. */
export interface Sent {
  readonly hash: Hash;
  readonly receipt: TransactionReceipt;
}

/**
 * Simulates a write (eth_call, then eth_estimateGas, which reverts on failure) and checks the
 * worst case against the budget. Returns the gas estimate. Sends nothing.
 */
export async function preflight(
  c: Connection,
  guard: SpendGuard,
  tx: { to: `0x${string}` | undefined; data: Hex },
  label: string,
  log: Log,
): Promise<bigint> {
  const account = c.account.address;
  if (tx.to !== undefined) await c.publicClient.call({ account, to: tx.to, data: tx.data });
  const gas = await c.publicClient.estimateGas({ account, to: tx.to, data: tx.data });
  const price = await c.publicClient.getGasPrice();
  const balance = await c.publicClient.getBalance({ address: account });
  guard.assertCanSpend(balance, worstCaseGas(gas), price);
  log(`  simulated ${label}: gas estimate ${gas}, gas price ${price} aokrw`);
  return gas;
}

export async function confirm(c: Connection, hash: Hash, label: string, log: Log): Promise<Sent> {
  log(`  sent ${label}: ${hash}`);
  const receipt = await c.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success')
    throw new Error(`${label} reverted in block ${receipt.blockNumber} (${hash})`);
  log(`  mined ${label} in block ${receipt.blockNumber}, gas used ${receipt.gasUsed}`);
  return { hash, receipt };
}

export async function spentSoFar(c: Connection, guard: SpendGuard): Promise<string> {
  const balance = await c.publicClient.getBalance({ address: c.account.address });
  return formatEther(guard.spent(balance));
}

export async function readCurrentPolicies(
  c: ReadConnection,
  contract: `0x${string}`,
): Promise<RawPolicySet[]> {
  const out = (await c.publicClient.pcl.contractPolicies({ contract })) as unknown;
  return extractPolicies(out);
}

/** contractPolicies returns the set of policies, possibly wrapped. Accepts the array or {policies}. */
export function extractPolicies(out: unknown): RawPolicySet[] {
  const list = Array.isArray(out) ? out : (out as { policies?: unknown }).policies;
  if (!Array.isArray(list)) throw new Error('unexpected contractPolicies result shape');
  return list.map((p: { templateId: string; policy: Hex; selector: Hex }) => ({
    templateId: p.templateId,
    policy: p.policy,
    selector: p.selector,
  }));
}
