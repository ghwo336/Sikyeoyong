/**
 * pnpm contracts:deploy:testnet -- --profile demo
 *
 * Deploys SikyeoyongOrders behind a PCL UUPS proxy and installs its contract-scope policies
 * (tech-spec 5.5, 5.6, chain-and-pcl.md). Real transactions: it spends gas from OPERATOR_KEY.
 * Steps: forge build, implementation, deployPclProxy(UUPS, initialize), checks, policies,
 * read-back, deployment record. Refuses when the record for chain and profile exists unless --force.
 * The key comes from the environment (node --env-file), is never printed, never written.
 * No automatic retry (CLAUDE.md 9): a failure stops the run and prints what already happened.
 */
import { pclProxyKinds, deployPclProxy, isPclProxy } from '@maroo-chain/viem';
import { explorerTxUrl, okrwToAokrw, type DeploymentRecord } from '@sikyeoyong/shared';
import { encodeDeployData, encodeFunctionData, formatEther, getAddress, type Hex } from 'viem';
import {
  assertChainId,
  assertNoRecord,
  confirm,
  loadOrdersArtifact,
  preflight,
  readCurrentPolicies,
} from '../src/chain-steps.ts';
import { parseArgs } from '../src/cli.ts';
import { SpendGuard, connect } from '../src/connect.ts';
import {
  buildOrdersPolicies,
  diffPolicies,
  policyHash,
  summarizePolicies,
} from '../src/policies.ts';
import { writeRecord } from '../src/record.ts';

const log = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const c = connect(args.network, process.env);
  const { chainConfig, account, publicClient, walletClient } = c;

  assertNoRecord(chainConfig.chainId, args.profile, args.force);
  await assertChainId(publicClient, chainConfig.chainId);

  // KYB policy input only matters for the default profile (D-33: the demo profile has none).
  let kyb;
  if (args.profile === 'default') {
    const uid = process.env['KYB_SCHEMA_UID'] ?? '';
    if (!/^0x[0-9a-fA-F]{64}$/.test(uid))
      throw new Error('default profile needs KYB_SCHEMA_UID (Q-07)');
    const { eas, indexer } = await publicClient.eas.getParams();
    kyb = { easContract: eas, indexContract: indexer, schemaUid: uid as Hex };
  }
  const wantedPolicies = buildOrdersPolicies({
    profile: args.profile,
    okrwDenom: chainConfig.okrwDenom,
    kyb,
  });

  const startBalance = await publicClient.getBalance({ address: account.address });
  const guard = new SpendGuard(startBalance, okrwToAokrw(args.maxSpendOkrw));
  log(`network ${chainConfig.key}, chain ${chainConfig.chainId}, profile ${args.profile}`);
  log(
    `operator ${account.address}, balance ${formatEther(startBalance)} OKRW, budget ${args.maxSpendOkrw} OKRW`,
  );

  const artifact = loadOrdersArtifact(args.skipBuild);

  // 1. implementation
  log('1. implementation');
  const deployData = encodeDeployData({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [],
  });
  await preflight(c, guard, { to: undefined, data: deployData }, 'implementation', log);
  const implHash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    args: [],
  });
  const impl = await confirm(c, implHash, 'implementation', log);
  const implementation = impl.receipt.contractAddress;
  if (implementation === null || implementation === undefined)
    throw new Error('no implementation address');
  if ((await publicClient.getCode({ address: implementation })) === undefined) {
    throw new Error('implementation has no code');
  }
  log(`  implementation ${implementation}`);

  // 2. proxy: UUPS, initialize runs atomically (vaultMode false, D-08, D-24)
  log('2. PCL proxy (UUPS)');
  const initializer = encodeFunctionData({
    abi: artifact.abi,
    functionName: 'initialize',
    args: [account.address, account.address, false],
  });
  const proxyCall = deployPclProxy.call({
    kind: pclProxyKinds.UUPS,
    logic: implementation,
    initializer,
  });
  await preflight(c, guard, { to: proxyCall.to, data: proxyCall.data }, 'proxy', log);
  const proxyHash = await walletClient.pcl.deployPclProxy({
    kind: pclProxyKinds.UUPS,
    logic: implementation,
    initializer,
  });
  const proxyTx = await confirm(c, proxyHash, 'proxy', log);
  const proxy = getAddress(deployPclProxy.extractEvent(proxyTx.receipt.logs).args.proxy);
  log(`  proxy ${proxy}`);

  // 3. checks through the proxy
  log('3. checks');
  const info = await publicClient.pcl.pclProxy({ proxy });
  const registered = await isPclProxy(publicClient, { proxy });
  const owner = await publicClient.readContract({
    address: proxy,
    abi: artifact.abi,
    functionName: 'owner',
  });
  const operator = await publicClient.readContract({
    address: proxy,
    abi: artifact.abi,
    functionName: 'operator',
  });
  log(
    `  pclProxy ${JSON.stringify(info, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))}`,
  );
  log(`  isPclProxy ${registered}, owner ${String(owner)}, operator ${String(operator)}`);
  if (!registered || String(owner) !== account.address || String(operator) !== account.address) {
    throw new Error('proxy checks failed (isPclProxy, owner, operator)');
  }

  // 4. policies (full replacement; the proxy deployer is bound as policy admin)
  log('4. policies');
  const polCall = walletClient.pcl.changeContractPolicies.call({
    contract: proxy,
    admin: account.address,
    policies: wantedPolicies,
  });
  await preflight(c, guard, { to: polCall.to, data: polCall.data }, 'policies', log);
  const polHash = await walletClient.pcl.changeContractPolicies({
    contract: proxy,
    admin: account.address,
    policies: wantedPolicies,
  });
  const polTx = await confirm(c, polHash, 'policies', log);

  // 5. read back and compare
  log('5. read back');
  const onChain = await readCurrentPolicies(c, proxy);
  const diff = diffPolicies(onChain, wantedPolicies);
  const summary = summarizePolicies(onChain);
  log(JSON.stringify(summary, null, 2));
  if (!diff.same)
    throw new Error(`policies on chain differ from the request: ${JSON.stringify(diff)}`);

  const record: DeploymentRecord = {
    chainId: chainConfig.chainId,
    profile: args.profile,
    deployedAt: new Date().toISOString().slice(0, 10),
    operator: account.address,
    implementation,
    proxy,
    deployBlock: Number(proxyTx.receipt.blockNumber),
    txs: { implementation: impl.hash, proxy: proxyTx.hash, policies: polTx.hash },
    blocks: {
      implementation: Number(impl.receipt.blockNumber),
      proxy: Number(proxyTx.receipt.blockNumber),
      policies: Number(polTx.receipt.blockNumber),
    },
    policyHash: policyHash(onChain),
    policies: summary,
  };
  log(`record written: ${writeRecord(record)}`);
  log(
    'add the import line to packages/shared/src/config/deployments-data.ts if it is not there yet',
  );
  for (const [name, hash] of Object.entries(record.txs))
    log(`  ${name}: ${explorerTxUrl(chainConfig, hash)}`);
  const end = await publicClient.getBalance({ address: account.address });
  log(`gas spent: ${formatEther(startBalance - end)} OKRW`);
}

main().catch((error: unknown) => {
  // Only the message: never the environment, never request objects that could carry the key.
  console.error(
    `FAILED: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`,
  );
  process.exit(1);
});
