import { AppError, type Hex } from '@sikyeoyong/shared';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { createMarooPublicClient, createMarooWalletClient } from '../../common/onchain/clients.js';
import { resolveOrdersTarget } from '../../common/onchain/orders-target.js';
import type { AppConfig } from '../../config/env.js';
import { AgentKeyVault, type AgentKeyStore, parseMasterKey } from './agent-key-vault.js';
import {
  ManagedEoaPaymentProvider,
  type PublicPort,
  type WalletPort,
} from './managed-eoa.provider.js';

const OPERATOR_KEY_RE = /^(0x)?[0-9a-fA-F]{64}$/;

/** OPERATOR_KEY as an account. The message names the variable, never the value. */
export function operatorAccountOf(raw: string | undefined): PrivateKeyAccount {
  if (raw === undefined || !OPERATOR_KEY_RE.test(raw)) {
    throw new AppError('INTERNAL', {
      reason: 'OPERATOR_KEY is missing or is not a 32 byte hex key',
      variables: ['OPERATOR_KEY'],
    });
  }
  return privateKeyToAccount((raw.startsWith('0x') ? raw : `0x${raw}`) as Hex);
}

/**
 * Builds path B on the real chain: the SDK clients, the operator from OPERATOR_KEY, the key
 * vault from AGENT_KEY_ENCRYPTION_KEY and the orders proxy from shared config. Not unit tested
 * (it only wires); the provider's logic is tested through its ports and the e2e script runs it
 * for real.
 */
export function createManagedEoaProvider(
  config: AppConfig,
  store: AgentKeyStore,
): ManagedEoaPaymentProvider {
  const operator = operatorAccountOf(config.secrets.operatorKey);
  const vault = new AgentKeyVault(parseMasterKey(config.secrets.agentKeyEncryptionKey), store);
  const target = resolveOrdersTarget(config);
  const publicClient = createMarooPublicClient(config.chain);
  const port = (client: ReturnType<typeof createMarooWalletClient>): WalletPort => client;
  return new ManagedEoaPaymentProvider({
    publicClient: publicClient as unknown as PublicPort,
    operatorWallet: port(createMarooWalletClient(config.chain, operator)),
    walletFor: (account) => port(createMarooWalletClient(config.chain, account)),
    signWalletAuthorization: async (account, message) => {
      // The registry's own EIP-712 domain (ERC-8004 AgentWalletSet), read from the chain.
      const [, name, version, chainId, verifyingContract] =
        await publicClient.identity.eip712Domain();
      return account.signTypedData({
        domain: { name, version, chainId, verifyingContract },
        types: {
          AgentWalletSet: [
            { name: 'agentId', type: 'uint256' },
            { name: 'newWallet', type: 'address' },
            { name: 'owner', type: 'address' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'AgentWalletSet',
        message,
      });
    },
    vault,
    config: {
      operator,
      registry: config.chain.precompiles.identityRegistry,
      proxy: target.proxy,
      deployBlock: target.deployBlock,
      gasShareAokrw: config.payment.gasShareAokrw,
      confirmations: config.payment.confirmations,
    },
  });
}
