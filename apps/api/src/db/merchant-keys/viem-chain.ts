import type { ChainConfig } from '@sikyeoyong/shared';
import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { SweepChain } from './sweep.js';

/** Real chain access for the sweep CLI. Chain id and RPC come from the shared config only. */
export function createViemSweepChain(config: ChainConfig): SweepChain {
  const chain = defineChain({
    id: config.chainId,
    name: config.name,
    nativeCurrency: { name: 'OKRW', symbol: 'OKRW', decimals: config.okrwDecimals },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });
  const transport = http(config.rpcUrl);
  const pub = createPublicClient({ chain, transport });
  return {
    balanceOf: (address) => pub.getBalance({ address }),
    gasPrice: () => pub.getGasPrice(),
    estimateGas: (from, to, value) => pub.estimateGas({ account: from, to, value }),
    send: ({ privateKey, to, value, gas, gasPrice }) =>
      createWalletClient({
        account: privateKeyToAccount(privateKey),
        chain,
        transport,
      }).sendTransaction({
        to,
        value,
        gas,
        gasPrice,
      }),
  };
}
