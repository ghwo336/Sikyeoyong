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
        onRetry={() => {
          void wallet.refetch();
        }}
      />
    );
  }
  if (!wallet.data) {
    return <AllowanceSummary owner={0n} pocket={0n} loading />;
  }
  return (
    <AllowanceSummary
      owner={parseAokrw(wallet.data.owner)}
      pocket={parseAokrw(wallet.data.pocket)}
      // No top-up flow or endpoint exists yet (Q-41), so no button: it would do nothing.
    />
  );
}
