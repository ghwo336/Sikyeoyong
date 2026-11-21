'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { Button, FrozenPanel, TopBar } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useBudget } from '../../budget/hooks/useBudget';
import { useMe } from '../../me/hooks/useMe';
import { useRefundPocket, useSetFrozen, useWallet } from '../hooks/useWallet';

/**
 * Frozen.dc.html: the dragon sleeps; take the pocket back, or wake it. The pocket is never
 * shown as a number the app does not know: while loading nothing, and if the wallet cannot
 * be read (no wallet route yet) only waking is offered. Opened while the dragon is awake it
 * goes to the Wallet (replace), so "용이가 자고 있어요" is never said of an awake dragon.
 */
export function FrozenContainer() {
  const router = useRouter();
  const me = useMe().data;
  const wallet = useWallet();
  const refund = useRefundPocket();
  const wake = useSetFrozen();
  const awake = useBudget().data?.frozen === false;
  // Waking here goes to the chat itself (push below), so that move is not overridden.
  const leave = awake && !wake.isSuccess;
  useEffect(() => {
    if (leave) router.replace('/dragon');
  }, [leave, router]);
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
  if (!me || wallet.isPending || leave) return top;
  if (wallet.isError) {
    return (
      <>
        <TopBar hiddenTitle="용이가 자고 있어요" onBack={back} backLabel="대화로 돌아가기" />
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
