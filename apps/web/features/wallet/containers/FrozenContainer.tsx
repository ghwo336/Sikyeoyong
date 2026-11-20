'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { FrozenPanel } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useMe } from '../../me/hooks/useMe';
import { useRefundPocket, useSetFrozen, useWallet } from '../hooks/useWallet';

/** Frozen.dc.html: the dragon sleeps; take the pocket back, or wake it. */
export function FrozenContainer() {
  const router = useRouter();
  const me = useMe().data;
  const wallet = useWallet().data;
  const refund = useRefundPocket();
  const wake = useSetFrozen();
  if (!me) return null;
  return (
    <FrozenPanel
      pocket={wallet ? parseAokrw(wallet.pocket) : 0n}
      species={me.dragonSpecies}
      refunding={refund.isPending}
      onRefund={() => {
        if (!refund.isPending) refund.mutate();
      }}
      onWake={() => {
        if (wake.isPending) return;
        wake.mutate(false, {
          onSuccess: () => {
            router.push('/');
          },
        });
      }}
    />
  );
}
