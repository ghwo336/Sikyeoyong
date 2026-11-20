'use client';

import { ListRow, SPECIES_INFO, Switch } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useBudget } from '../../budget/hooks/useBudget';
import { useMe } from '../../me/hooks/useMe';
import { useDetailsMode } from '../hooks/useDetailsMode';
import { useSetFrozen } from '../hooks/useWallet';

/** Wallet.dc.html bottom rows: the look (D-32), the ID card, the pause switch and 자세히 보기. */
export function DragonControlsContainer() {
  const router = useRouter();
  const me = useMe().data;
  const budget = useBudget().data;
  const freeze = useSetFrozen();
  const [details, setDetails] = useDetailsMode();
  if (!me || !budget) return null;
  return (
    <>
      <ListRow
        label="용이 모습"
        value={SPECIES_INFO[me.dragonSpecies].name}
        trailing="chevron"
        onPress={() => {
          router.push('/dragon/look');
        }}
      />
      <ListRow
        label="용이 신분증"
        value={me.dragonName}
        trailing="chevron"
        onPress={() => {
          router.push('/dragon/id');
        }}
      />
      <ListRow
        label="용이 멈추기"
        trailing={(labelId) => (
          <Switch
            checked={budget.frozen}
            labelId={labelId}
            onChange={(on) => {
              if (!on || freeze.isPending) return; // waking happens on the Frozen screen
              freeze.mutate(true, {
                onSuccess: () => {
                  router.replace('/dragon/frozen');
                },
              });
            }}
          />
        )}
      />
      <ListRow
        label="자세히 보기"
        trailing={(labelId) => <Switch checked={details} labelId={labelId} onChange={setDetails} />}
      />
    </>
  );
}
