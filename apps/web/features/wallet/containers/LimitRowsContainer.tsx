'use client';

import { formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import { AmountRatio, ListRow, LoadingShape } from '@sikyeoyong/ui';
import { useBudget } from '../../budget/hooks/useBudget';
import { useWallet } from '../hooks/useWallet';

/** Wallet.dc.html middle rows: per order, my 30-day limit and its use, saved (D-31). */
export function LimitRowsContainer() {
  const { data: budget, isError } = useBudget();
  const wallet = useWallet().data;
  if (isError) return null;
  if (!budget) return <LoadingShape kind="rows" count={2} />;
  return (
    <>
      <ListRow label="한 번에 쓸 돈" value={formatOkrw(parseAokrw(budget.perOrderLimit))} />
      <ListRow
        label="30일에 쓸 돈"
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
