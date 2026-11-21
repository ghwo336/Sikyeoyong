'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { IdCard, LoadingShape, TopBar } from '@sikyeoyong/ui';
import { useTransitionRouter } from '../../../lib/transition-router';
import { useMe } from '../../me/hooks/useMe';
import { useIdCard } from '../hooks/useWallet';

/** IdCard.dc.html: the dragon's ID card. */
export function IdCardContainer() {
  const router = useTransitionRouter();
  const me = useMe().data;
  const card = useIdCard().data;
  const back = () => {
    router.push('/dragon');
  };
  if (!me || !card) {
    return (
      <>
        <TopBar title="용이 신분증" onBack={back} />
        <LoadingShape kind="detail" />
      </>
    );
  }
  return (
    <>
      <TopBar title="용이 신분증" onBack={back} />
      <IdCard
        name={me.dragonName}
        ownerName={card.ownerName}
        perOrder={parseAokrw(me.perOrderLimit)}
        ownerVerified={card.ownerVerified}
        bornAt={card.bornAt}
        species={me.dragonSpecies}
      />
    </>
  );
}
