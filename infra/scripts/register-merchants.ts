/**
 * pnpm merchants:register -- --keys <seed/.keys/merchants.json> --db <sqlite file> [--only a,b] [--dry-run]
 *
 * Registers every verified seed merchant on the orders proxy and activates it (D-33, tech-spec 7.1).
 * Real transactions. Per merchant: the operator sends the payout wallet gas money if it is short,
 * the payout wallet calls registerMerchant(0x0, metadataURI) (demo profile has no KYB policy),
 * the merchantId comes from the MerchantRegistered event, the operator calls setMerchantStatus(Active).
 * Resumable: the chain is asked first (merchantIdByPayout) and the record file is written after
 * every merchant. No automatic retry (CLAUDE.md 9): a failure stops the run.
 * Keys come from OPERATOR_KEY and the key file. Nothing secret is printed or written.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  DEPLOYMENTS,
  findDeployment,
  explorerTxUrl,
  okrwToAokrw,
  parseMerchantOnchain,
  resolveOrdersContract,
  withMerchantEntry,
  type MerchantOnchainEntry,
  type MerchantOnchainRecord,
} from '@sikyeoyong/shared';
import { marooWalletActions } from '@maroo-chain/viem';
import {
  createWalletClient,
  encodeFunctionData,
  formatEther,
  getAddress,
  http,
  parseEventLogs,
  zeroHash,
  type Address,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { SpendGuard, connect } from '../src/connect.ts';
import { REPO_ROOT } from '../src/record.ts';
import {
  MERCHANT_ABI,
  STATUS_ACTIVE,
  STATUS_PENDING,
  parseRegisterArgs,
  readMetadataUris,
  readPayoutKeys,
  readSeedMerchants,
  requiredGasMoney,
  topUpAmount,
} from '../src/merchants-plan.ts';

const log = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

async function main(): Promise<void> {
  const args = parseRegisterArgs(process.argv.slice(2));
  const c = connect(args.network, process.env);
  const { chainConfig, chain, account: operator, publicClient, walletClient } = c;
  const proxy = getAddress(
    resolveOrdersContract(
      DEPLOYMENTS,
      chainConfig.chainId,
      args.profile,
      process.env['ORDERS_CONTRACT'],
    ),
  );
  if ((await publicClient.getChainId()) !== chainConfig.chainId)
    throw new Error('RPC chain id differs from config; nothing sent');

  const deployBlock =
    findDeployment(DEPLOYMENTS, chainConfig.chainId, args.profile)?.deployBlock ?? 0;
  const outPath =
    args.out ?? join(REPO_ROOT, 'seed', 'onchain', `${chainConfig.chainId}.${args.profile}.json`);
  let record: MerchantOnchainRecord = existsSync(outPath)
    ? parseMerchantOnchain(JSON.parse(readFileSync(outPath, 'utf8')))
    : { chainId: chainConfig.chainId, profile: args.profile, proxy, merchants: [] };
  if (record.chainId !== chainConfig.chainId || record.proxy.toLowerCase() !== proxy.toLowerCase())
    throw new Error('record belongs to another chain or proxy; use --out for a new file');
  const save = (): void => {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  };

  const seed = readSeedMerchants(args.seed).filter(
    (m) => m.verified && (args.only.length === 0 || args.only.includes(m.key)),
  );
  const keys = readPayoutKeys(args.keys);
  const metadata = readMetadataUris(args.db);
  const done = new Set(record.merchants.map((m) => m.merchantKey));

  const startBalance = await publicClient.getBalance({ address: operator.address });
  const guard = new SpendGuard(startBalance, okrwToAokrw(args.maxSpendOkrw));
  // Everything the operator pays out counts: gas for its own writes and the gas money it sends.
  const assertBudget = async (extra: bigint): Promise<void> => {
    guard.assertCanSpendAmount(await publicClient.getBalance({ address: operator.address }), extra);
  };
  log(`network ${chainConfig.key}, profile ${args.profile}, proxy ${proxy}`);
  log(
    `operator ${operator.address}, balance ${formatEther(startBalance)} OKRW, budget ${args.maxSpendOkrw} OKRW`,
  );
  log(
    `verified merchants in scope: ${seed.length}, already in record: ${seed.filter((m) => done.has(m.key)).length}`,
  );

  const wait = async (hash: Hash, label: string) => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success')
      throw new Error(`${label} reverted in block ${receipt.blockNumber} (${hash})`);
    return receipt;
  };

  let registered = 0;
  for (const m of seed) {
    if (done.has(m.key)) continue;
    const pk = keys.get(m.key);
    if (pk === undefined) throw new Error(`no payout key for ${m.key}`);
    const payoutAccount = privateKeyToAccount(pk);
    const payout: Address = payoutAccount.address;
    const metadataUri = metadata.get(payout.toLowerCase());
    if (metadataUri === undefined)
      throw new Error(`no DB row for ${m.key} (payout ${payout}); run db:seed first`);
    log(`${m.key} payout ${payout}`);

    let id = await publicClient.readContract({
      address: proxy,
      abi: MERCHANT_ABI,
      functionName: 'merchantIdByPayout',
      args: [payout],
    });
    let fundHash: Hash | null = null;
    let registerHash: Hash;
    let registerBlock: bigint;

    if (id === 0n) {
      // 1. gas money
      const callData = encodeFunctionData({
        abi: MERCHANT_ABI,
        functionName: 'registerMerchant',
        args: [zeroHash, metadataUri],
      });
      const fees = await publicClient.estimateFeesPerGas();
      const price = fees.maxFeePerGas;
      const gas = await publicClient.estimateGas({ account: payout, to: proxy, data: callData });
      const required = requiredGasMoney(gas, price);
      const balance = await publicClient.getBalance({ address: payout });
      const topUp = topUpAmount(required, balance);
      if (args.dryRun) {
        log(`  dry run: gas ${gas}, price ${price}, would send ${formatEther(topUp)} OKRW`);
        continue;
      }
      if (topUp > 0n) {
        const sim = await publicClient.estimateGas({ account: operator, to: payout, value: topUp });
        await assertBudget(topUp + sim * 2n * price);
        fundHash = await walletClient.sendTransaction({
          to: payout,
          value: topUp,
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
        await wait(fundHash, 'fund');
        log(`  funded ${formatEther(topUp)} OKRW: ${fundHash}`);
      }
      // 2. register by the payout wallet, simulated first
      await publicClient.simulateContract({
        account: payoutAccount,
        address: proxy,
        abi: MERCHANT_ABI,
        functionName: 'registerMerchant',
        args: [zeroHash, metadataUri],
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      });
      const payoutClient = createWalletClient({
        account: payoutAccount,
        chain,
        transport: http(chainConfig.rpcUrl),
      }).extend(marooWalletActions());
      registerHash = await payoutClient.writeContract({
        address: proxy,
        abi: MERCHANT_ABI,
        functionName: 'registerMerchant',
        args: [zeroHash, metadataUri],
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      });
      const receipt = await wait(registerHash, 'register');
      const events = parseEventLogs({
        abi: MERCHANT_ABI,
        eventName: 'MerchantRegistered',
        logs: receipt.logs,
      });
      const ev = events.find((e) => e.args.payout.toLowerCase() === payout.toLowerCase());
      if (ev === undefined) throw new Error(`no MerchantRegistered event in ${registerHash}`);
      id = ev.args.merchantId;
      registerBlock = receipt.blockNumber;
      log(`  registered id ${id}: ${registerHash}`);
    } else {
      // Resume: registered earlier but not in the record. Recover hashes from the event log.
      const logs = await publicClient.getContractEvents({
        address: proxy,
        abi: MERCHANT_ABI,
        eventName: 'MerchantRegistered',
        args: { merchantId: id },
        fromBlock: BigInt(deployBlock),
      });
      const ev = logs[0];
      if (ev === undefined)
        throw new Error(`merchant ${id} registered but its event was not found`);
      registerHash = ev.transactionHash;
      registerBlock = ev.blockNumber;
      log(`  already registered as ${id}`);
    }

    // 3. activate by the operator
    const onchain = await publicClient.readContract({
      address: proxy,
      abi: MERCHANT_ABI,
      functionName: 'merchants',
      args: [id],
    });
    let activateHash: Hash;
    let activateBlock: bigint;
    if (onchain[2] === STATUS_PENDING) {
      const fees = await publicClient.estimateFeesPerGas();
      const price = fees.maxFeePerGas;
      await publicClient.simulateContract({
        account: operator,
        address: proxy,
        abi: MERCHANT_ABI,
        functionName: 'setMerchantStatus',
        args: [id, STATUS_ACTIVE],
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      });
      const gas = await publicClient.estimateGas({
        account: operator,
        to: proxy,
        data: encodeFunctionData({
          abi: MERCHANT_ABI,
          functionName: 'setMerchantStatus',
          args: [id, STATUS_ACTIVE],
        }),
      });
      await assertBudget(gas * 2n * price);
      activateHash = await walletClient.writeContract({
        address: proxy,
        abi: MERCHANT_ABI,
        functionName: 'setMerchantStatus',
        args: [id, STATUS_ACTIVE],
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      });
      const receipt = await wait(activateHash, 'activate');
      activateBlock = receipt.blockNumber;
      log(`  activated: ${activateHash}`);
    } else if (onchain[2] === STATUS_ACTIVE) {
      const logs = await publicClient.getContractEvents({
        address: proxy,
        abi: MERCHANT_ABI,
        eventName: 'MerchantStatusChanged',
        args: { merchantId: id },
        fromBlock: BigInt(deployBlock),
      });
      const ev = logs.filter((l) => l.args.status === STATUS_ACTIVE).at(-1);
      if (ev === undefined)
        throw new Error(`merchant ${id} is active but its status event was not found`);
      activateHash = ev.transactionHash;
      activateBlock = ev.blockNumber;
    } else throw new Error(`merchant ${id} has unexpected status ${onchain[2]}`);

    const entry: MerchantOnchainEntry = {
      merchantKey: m.key,
      onchainId: id.toString(),
      payout,
      metadataUri,
      txs: { fund: fundHash, register: registerHash, activate: activateHash },
      blocks: { register: Number(registerBlock), activate: Number(activateBlock) },
    };
    record = withMerchantEntry(record, entry);
    save();
    registered += 1;
  }

  const end = await publicClient.getBalance({ address: operator.address });
  log(`registered this run: ${registered}, record entries: ${record.merchants.length}`);
  log(`operator spent (gas and gas money): ${formatEther(startBalance - end)} OKRW`);
  for (const e of record.merchants.slice(0, 3))
    log(`  ${e.merchantKey} id ${e.onchainId}: ${explorerTxUrl(chainConfig, e.txs.register)}`);
  if (!args.dryRun) log(`record: ${outPath}`);
}

main().catch((error: unknown) => {
  console.error(
    `FAILED: ${error instanceof Error ? error.message.split('\n')[0] : 'unknown error'}`,
  );
  process.exit(1);
});
