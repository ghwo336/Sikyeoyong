'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { AllowanceSummary } from '@sikyeoyong/ui';
import { useWallet } from '../hooks/useWallet';

/** Wallet.dc.html top: the owner's allowance and the dragon's pocket. Nothing when unknown. */
export function AllowanceContainer() {
  const wallet = useWallet();
  // No made-up balance: while the server has no wallet route, the row is simply absent.
  if (wallet.isError) return null;
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
