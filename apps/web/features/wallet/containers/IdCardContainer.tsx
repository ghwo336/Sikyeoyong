'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { IdCard, TopBar } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useMe } from '../../me/hooks/useMe';
import { useIdCard } from '../hooks/useWallet';

/** IdCard.dc.html: the dragon's ID card. */
export function IdCardContainer() {
  const router = useRouter();
  const me = useMe().data;
  const card = useIdCard().data;
  const back = () => {
    router.push('/dragon');
  };
  if (!me || !card) return <TopBar title="용이 신분증" onBack={back} />;
  return (
    <>
      <TopBar title="용이 신분증" onBack={back} />
      <IdCard
        name={me.dragonName}
        ownerName={card.ownerName}
        level={me.level}
        perOrder={parseAokrw(me.perOrderLimit)}
        ownerVerified={card.ownerVerified}
        bornAt={card.bornAt}
        species={me.dragonSpecies}
      />
    </>
  );
}
