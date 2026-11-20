/**
 * pnpm policy:apply -- --profile demo [--check]
 *
 * Rebuilds the contract-scope policies from packages/shared policy.ts and writes them to the
 * deployed proxy. changeContractPolicies replaces everything, so it reads the current policies
 * first and refuses when the chain holds a selector policy.ts does not manage (it would be
 * deleted silently). --check only compares and exits 1 on a difference (chain-and-pcl.md).
 */
import { explorerTxUrl, okrwToAokrw } from '@sikyeoyong/shared';
import { formatEther, type Hex } from 'viem';
import { confirm, preflight, readCurrentPolicies } from '../src/chain-steps.ts';
import { parseArgs } from '../src/cli.ts';
import { SpendGuard, connect } from '../src/connect.ts';
import {
  buildOrdersPolicies,
  diffPolicies,
  policyHash,
  summarizePolicies,
} from '../src/policies.ts';
import { readRecord, writeRecord } from '../src/record.ts';

const log = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const c = connect(args.network, process.env);
  const { chainConfig, account, publicClient, walletClient } = c;
  const record = readRecord(chainConfig.chainId, args.profile);
  const proxy = record.proxy as `0x${string}`;

  let kyb;
  if (args.profile === 'default') {
    const uid = process.env['KYB_SCHEMA_UID'] ?? '';
    if (!/^0x[0-9a-fA-F]{64}$/.test(uid))
      throw new Error('default profile needs KYB_SCHEMA_UID (Q-07)');
    const { eas, indexer } = await publicClient.eas.getParams();
    kyb = { easContract: eas, indexContract: indexer, schemaUid: uid as Hex };
  }
  const wanted = buildOrdersPolicies({
    profile: args.profile,
    okrwDenom: chainConfig.okrwDenom,
    kyb,
  });
  const current = await readCurrentPolicies(c, proxy);
  const diff = diffPolicies(current, wanted);

  if (diff.same) {
    log(`policies on ${proxy} match policy.ts (${args.profile})`);
    return;
  }
  log(`difference: ${JSON.stringify(diff)}`);
  if (args.check) process.exit(1);
  if (diff.unmanaged.length > 0) {
    throw new Error(
      `chain holds selectors policy.ts does not manage: ${diff.unmanaged.join(', ')}`,
    );
  }

  const startBalance = await publicClient.getBalance({ address: account.address });
  const guard = new SpendGuard(startBalance, okrwToAokrw(args.maxSpendOkrw));
  const call = walletClient.pcl.changeContractPolicies.call({
    contract: proxy,
    admin: account.address,
    policies: wanted,
  });
  await preflight(c, guard, { to: call.to, data: call.data }, 'policies', log);
  const hash = await walletClient.pcl.changeContractPolicies({
    contract: proxy,
    admin: account.address,
    policies: wanted,
  });
  const tx = await confirm(c, hash, 'policies', log);

  const after = await readCurrentPolicies(c, proxy);
  if (!diffPolicies(after, wanted).same) throw new Error('policies on chain differ after apply');
  writeRecord({
    ...record,
    txs: { ...record.txs, policies: tx.hash },
    blocks: { ...record.blocks, policies: Number(tx.receipt.blockNumber) },
    policyHash: policyHash(after),
    policies: summarizePolicies(after),
  });
  log(`applied: ${explorerTxUrl(chainConfig, tx.hash)}`);
  const end = await publicClient.getBalance({ address: account.address });
  log(`gas spent: ${formatEther(startBalance - end)} OKRW`);
}

main().catch((error: unknown) => {
  console.error(
    `FAILED: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`,
  );
  process.exit(1);
});
