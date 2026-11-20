/**
 * pnpm e2e:path-b -- --run [--merchant <onchainId>]
 *
 * Owner-run, REAL testnet transactions (payment path B, D-25). It makes a throwaway agent through
 * ManagedEoaPaymentProvider and walks the whole money path on Maroo testnet with the demo policy
 * profile: 8004 register and wallet link, TransferLimit, bindAgent, fund, one order that passes
 * (OrderPlaced), one that the per-order limit refuses (ExceededAgentTransferLimit decoded as
 * CHAIN_AGENT_LIMIT), the 30-day volume read, freeze (AgentIsPaused), then drain back to the
 * operator. Keys come from the environment (node --env-file), are never printed, never retried:
 * a failing step stops the run and says what already happened. The throwaway agent key is kept in
 * ./data/e2e-path-b.db so a stopped run can be drained with --drain <agent address>.
 */
import { mkdirSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  explorerTxUrl,
  formatOkrw,
  okrwToAokrw,
  type AgentWallet,
  type Hex,
} from '@sikyeoyong/shared';
import { formatEther, keccak256, toHex } from 'viem';
import { createMarooPublicClient } from '../../common/onchain/clients.js';
import { ordersAbi } from '../../common/onchain/orders-abi.js';
import { resolveOrdersTarget } from '../../common/onchain/orders-target.js';
import { loadConfig } from '../../config/env.js';
import { openDb } from '../../db/client.js';
import { runMigrations } from '../../db/migrate.js';
import { createChainReader } from '../chain/chain.service.js';
import { AgentKeysRepository } from './agent-keys.repository.js';
import { createManagedEoaProvider, operatorAccountOf } from './managed-eoa.factory.js';

const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};
const OKRW = (won: bigint): bigint => okrwToAokrw(won);
/** The agent float for the run: one 9,000 order, 1,000 left for the refused order, and gas. */
const FUND_WON = 10_500n;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      run: { type: 'boolean' },
      merchant: { type: 'string' },
      drain: { type: 'string' },
      scan: { type: 'boolean' },
    },
  });
  if (values.run !== true && values.drain === undefined && values.scan !== true) {
    out('usage: e2e:path-b --run [--merchant <onchainId>] | --drain <agent address>');
    out('REAL testnet transactions. Needs OPERATOR_KEY and AGENT_KEY_ENCRYPTION_KEY in the env.');
    return;
  }
  const config = loadConfig({
    ...process.env,
    NODE_ENV: 'development',
    PAYMENT_PATH: 'B',
    POLICY_PROFILE: 'demo',
  });
  const operator = operatorAccountOf(config.secrets.operatorKey);
  const publicClient = createMarooPublicClient(config.chain);
  const rpcChainId = await publicClient.getChainId();
  if (rpcChainId !== config.chain.chainId) {
    throw new Error(
      `RPC chain id ${rpcChainId} differs from config ${config.chain.chainId}; nothing sent`,
    );
  }
  const target = resolveOrdersTarget(config);
  mkdirSync('./data', { recursive: true });
  const db = openDb('file:./data/e2e-path-b.db');
  runMigrations(db.db);
  const provider = createManagedEoaProvider(config, new AgentKeysRepository(db));
  const link = (hash: string): string => explorerTxUrl(config.chain, hash);
  const startBalance = await publicClient.getBalance({ address: operator.address });
  out(`chain ${config.chain.chainId}, orders proxy ${target.proxy}`);
  out(`operator ${operator.address}, balance ${formatEther(startBalance)} OKRW`);

  if (values.drain !== undefined) {
    const wallet: AgentWallet = {
      agentRowId: '',
      address: values.drain as Hex,
      ownerAddress: operator.address,
    };
    const hashes = await provider.drain(wallet);
    out(`drained ${hashes.length === 0 ? 'nothing' : hashes.map(link).join(' ')}`);
    return;
  }

  if (values.scan === true) {
    const next = await publicClient.readContract({
      address: target.proxy,
      abi: ordersAbi,
      functionName: 'nextMerchantId',
    });
    out(`next merchant id ${String(next)}`);
    for (let id = 1n; id < next; id += 1n) {
      const [payout, , status] = await publicClient.readContract({
        address: target.proxy,
        abi: ordersAbi,
        functionName: 'merchants',
        args: [id],
      });
      out(`  ${String(id)} payout ${payout} status ${status}`);
    }
    return;
  }
  const merchantId = await pickMerchant(publicClient, target.proxy, values.merchant);
  out(`merchant on chain: ${merchantId}`);

  // 1. the agent: key, 8004 register, wallet link
  out('\n1. createAgent (register + setAgentWallet)');
  const agent = await provider.createAgent({ userId: 'e2e', name: 'e2e-path-b' });
  out(`  agent wallet ${agent.address}, 8004 id ${String(agent.onchainAgentId)}`);
  const agentIds = await publicClient.agent.getAgentIds({
    args: [agent.address, { key: '0x', offset: 0n, limit: 10n, countTotal: true, reverse: false }],
  });
  out(`  Agent precompile getAgentIds(agent wallet) = ${JSON.stringify(agentIds[0].map(String))}`);
  const byOperator = await publicClient.agent.getAgentIds({
    args: [
      operator.address,
      { key: '0x', offset: 0n, limit: 50n, countTotal: true, reverse: false },
    ],
  });
  out(
    `  Agent precompile getAgentIds(operator) has this id: ${String(byOperator[0].includes(agent.onchainAgentId ?? -1n))}`,
  );

  try {
    // 2. TransferLimit, bind, fund
    out('\n2. setTransferLimit 10,000 / bindAgent / fund 10,500');
    out(`  setTransferLimit ${link(await provider.setTransferLimit(agent, OKRW(10_000n)))}`);
    out(`  bindAgent ${link(await provider.bindAgent(agent))}`);
    out(`  fund ${link(await provider.fund(agent, OKRW(FUND_WON)))}`);
    out(`  agent balance ${formatEther(await provider.balanceOf(agent.address))} OKRW`);

    // 3a. an order that passes
    out('\n3a. order 9,000 OKRW (limit 10,000)');
    const refA = keccak256(toHex(`e2e-a-${String(Date.now())}`));
    const reqA = { agent, merchantOnchainId: merchantId, amount: OKRW(9_000n), orderRef: refA };
    out(`  preflight ${JSON.stringify(await provider.preflight(reqA))}`);
    const signed: { hash: Hex | null } = { hash: null };
    const payA = await provider.pay({
      ...reqA,
      beforeBroadcast: ({ txHash, nonce }) => {
        signed.hash = txHash;
        out(`  signed ${txHash} nonce ${nonce} (saved before broadcast)`);
      },
    });
    out(
      `  pay ${payA.ok ? `ok block ${payA.blockNumber} ${link(payA.txHash)}` : JSON.stringify(payA)}`,
    );
    if (!payA.ok) throw new Error('order A did not pass');
    out(`  signed hash equals the mined hash: ${String(signed.hash === payA.txHash)}`);
    const found = await provider.findPaid(refA);
    out(`  findPaid ${found === null ? 'null' : `${found.txHash} block ${found.blockNumber}`}`);

    // 3b. over the per-order limit
    out('\n3b. TransferLimit 500, order 1,000 (over the per-order limit)');
    const payAgain = await provider.preflight({ ...reqA, amount: OKRW(1_000n) });
    out(
      `  same orderRef again, preflight ${JSON.stringify(payAgain)} (OrderExists is not in the table: INTERNAL)`,
    );
    out(`  setTransferLimit ${link(await provider.setTransferLimit(agent, OKRW(500n)))}`);
    const reqB = {
      agent,
      merchantOnchainId: merchantId,
      amount: OKRW(1_000n),
      orderRef: keccak256(toHex(`e2e-b-${String(Date.now())}`)),
    };
    const preB = await provider.preflight(reqB);
    out(`  preflight ${JSON.stringify(preB)}`);
    const payB = await provider.pay(reqB);
    out(
      `  pay ${JSON.stringify(payB, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))}`,
    );
    if (!payB.ok && payB.txHash !== undefined) out(`  reverted tx ${link(payB.txHash)}`);

    // 3c. the 30-day volume
    out('\n3c. 30-day volume');
    const reader = createChainReader(config, provider);
    const vol = await reader.periodicVolume(agent.address);
    out(
      `  periodicVolume(agent) = ${formatOkrw(vol.usedAokrw)}, resetAt ${String(vol.resetAtSec)}`,
    );
    const volOperator = await reader.periodicVolume(operator.address);
    out(`  periodicVolume(operator) = ${formatOkrw(volOperator.usedAokrw)}`);

    // 4. freeze
    out('\n4. freeze and unfreeze');
    out(`  freeze ${(await provider.freeze(agent)).map(link).join(' ')}`);
    out(
      `  preflight while frozen ${JSON.stringify(await provider.preflight({ ...reqB, amount: OKRW(400n) }))}`,
    );
    out(`  unfreeze ${(await provider.unfreeze(agent)).map(link).join(' ')}`);
  } finally {
    // 5. whatever happened, take the money back
    out('\n5. drain');
    const hashes = await provider.drain(agent);
    out(`  drain ${hashes.length === 0 ? 'nothing to drain' : hashes.map(link).join(' ')}`);
    out(`  agent balance ${formatEther(await provider.balanceOf(agent.address))} OKRW`);
    const end = await publicClient.getBalance({ address: operator.address });
    out(`\noperator balance ${formatEther(end)} OKRW (change ${formatEther(end - startBalance)})`);
  }
}

/** The first Active merchant on chain, or the one asked for. */
async function pickMerchant(
  client: ReturnType<typeof createMarooPublicClient>,
  proxy: Hex,
  asked: string | undefined,
): Promise<bigint> {
  const next = await client.readContract({
    address: proxy,
    abi: ordersAbi,
    functionName: 'nextMerchantId',
  });
  const ACTIVE = 2;
  for (let id = 1n; id < next; id += 1n) {
    if (asked !== undefined && id !== BigInt(asked)) continue;
    const [, , status] = await client.readContract({
      address: proxy,
      abi: ordersAbi,
      functionName: 'merchants',
      args: [id],
    });
    if (status === ACTIVE) return id;
  }
  throw new Error(`no Active merchant on chain (next id ${String(next)}); register one first`);
}

main().catch((e: unknown) => {
  process.stderr.write(`e2e stopped: ${e instanceof Error ? e.message : 'unknown error'}\n`);
  process.exitCode = 1;
});
