'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { ErrorLine, LeakCompare, Skeleton, TopBar } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useDetailsMode } from '../../wallet/hooks/useDetailsMode';
import { useLeakCompare } from '../hooks/useLeakCompare';

/** LeakCompare.dc.html (demo scene 5): title row, then the comparison with the real numbers. */
export function LeakCompareContainer() {
  const router = useRouter();
  const view = useLeakCompare();
  const [details] = useDetailsMode();
  return (
    <>
      <TopBar
        title="열쇠를 도둑맞았다면"
        onBack={() => {
          router.push('/dragon');
        }}
      />
      {view.data ? (
        <LeakCompare
          perOrderLimit={parseAokrw(view.data.perOrderLimit)}
          periodicCap={parseAokrw(view.data.periodicCap)}
          periodSec={view.data.periodicPeriodSec}
          floatAtRisk={parseAokrw(view.data.floatAtRisk)}
          pocket={parseAokrw(view.data.pocket)}
          detailed={details}
        />
      ) : view.isError ? (
        <ErrorLine>못 불러왔어요. 다시 열어 볼까요?</ErrorLine>
      ) : (
        <div aria-busy="true" data-part="loading">
          <Skeleton height="walletAmount" width="10em" data-part="skeleton" />
          <Skeleton height="caption" width="7.5em" data-part="skeleton" />
        </div>
      )}
    </>
  );
}
