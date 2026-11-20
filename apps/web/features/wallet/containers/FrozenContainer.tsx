'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { Button, FrozenPanel, TopBar } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useMe } from '../../me/hooks/useMe';
import { useRefundPocket, useSetFrozen, useWallet } from '../hooks/useWallet';

/**
 * Frozen.dc.html: the dragon sleeps; take the pocket back, or wake it. The pocket is never
 * shown as a number the app does not know: while loading nothing, and if the wallet cannot
 * be read (no wallet route yet) only waking is offered.
 */
export function FrozenContainer() {
  const router = useRouter();
  const me = useMe().data;
  const wallet = useWallet();
  const refund = useRefundPocket();
  const wake = useSetFrozen();
  const back = () => {
    router.push('/');
  };
  const onWake = () => {
    if (wake.isPending) return;
    wake.mutate(false, {
      onSuccess: () => {
        router.push('/');
      },
    });
  };
  const top = <TopBar onBack={back} backLabel="대화로 돌아가기" />;
  if (!me || wallet.isPending) return top;
  if (wallet.isError) {
    return (
      <>
        {top}
        <Button variant="primary" loading={wake.isPending} onPress={onWake}>
          용이 깨우기
        </Button>
      </>
    );
  }
  return (
    <>
      {top}
      <FrozenPanel
        pocket={parseAokrw(wallet.data.pocket)}
        species={me.dragonSpecies}
        refunding={refund.isPending}
        onRefund={() => {
          if (!refund.isPending) refund.mutate();
        }}
        onWake={onWake}
      />
    </>
  );
}
