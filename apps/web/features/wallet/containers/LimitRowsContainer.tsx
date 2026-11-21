'use client';

import { formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import { AmountRatio, ListRow, LoadingShape, RetryLine } from '@sikyeoyong/ui';
import { useTransitionRouter } from '../../../lib/transition-router';
import { useBudget } from '../../budget/hooks/useBudget';
import { useWallet } from '../hooks/useWallet';

/**
 * Wallet.dc.html middle rows: per order, my 30-day limit and its use, saved (D-31). The first
 * two open the limit screen (chevron, as the design draws them).
 */
export function LimitRowsContainer() {
  const router = useTransitionRouter();
  const { data: budget, isError, refetch } = useBudget();
  const wallet = useWallet().data;
  // Both rows open the same screen, which edits the two limits together (D-31).
  const editLimits = () => {
    router.push('/dragon/limits');
  };
  // A failed read keeps its place with an error line and a retry, not a missing block (QA 6 M3).
  if (isError && !budget) {
    return (
      <RetryLine
        onRetry={() => {
          void refetch();
        }}
      >
        한도를 못 불러왔어요
      </RetryLine>
    );
  }
  if (!budget) return <LoadingShape kind="rows" count={2} />;
  return (
    <>
      <ListRow
        label="한 번에 쓸 돈"
        value={formatOkrw(parseAokrw(budget.perOrderLimit))}
        trailing="chevron"
        onPress={editLimits}
      />
      <ListRow
        label="30일에 쓸 돈"
        trailing="chevron"
        onPress={editLimits}
        value={
          <AmountRatio
            value={parseAokrw(budget.chainUsed)}
            max={parseAokrw(budget.myPeriodicLimit)}
            size="meter"
            valueUnit={false}
          />
        }
      />
      {wallet && (
        <ListRow
          label="이번 달 아낀 돈"
          value={formatOkrw(parseAokrw(wallet.savedThisMonth))}
          tone="accent"
        />
      )}
    </>
  );
}
