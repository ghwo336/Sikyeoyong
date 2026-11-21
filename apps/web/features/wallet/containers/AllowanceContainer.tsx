'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { AllowanceSummary } from '@sikyeoyong/ui';
import { useWallet } from '../hooks/useWallet';

/**
 * Wallet.dc.html top: the owner's allowance and the dragon's pocket. A failed read keeps its
 * place with a retry line (like the limit rows), never made-up numbers and never a missing block.
 */
export function AllowanceContainer() {
  const wallet = useWallet();
  if (!wallet.data && wallet.isError) {
    return (
      <AllowanceSummary
        owner={0n}
        pocket={0n}
        onTopUp={() => undefined}
        onRetry={() => {
          void wallet.refetch();
        }}
      />
    );
  }
  if (!wallet.data) {
    return <AllowanceSummary owner={0n} pocket={0n} loading onTopUp={() => undefined} />;
  }
  return (
    <AllowanceSummary
      owner={parseAokrw(wallet.data.owner)}
      pocket={parseAokrw(wallet.data.pocket)}
      // Topping up the owner's allowance has no flow yet (web.md "아직").
      onTopUp={() => undefined}
    />
  );
}
