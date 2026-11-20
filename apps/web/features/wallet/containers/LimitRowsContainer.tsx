'use client';

import { formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import { AmountRatio, ListRow } from '@sikyeoyong/ui';
import { useBudget } from '../../budget/hooks/useBudget';
import { useWallet } from '../hooks/useWallet';

/** Wallet.dc.html middle rows: per order, 30 days, this month's budget, saved this month. */
export function LimitRowsContainer() {
  const budget = useBudget().data;
  const wallet = useWallet().data;
  if (!budget) return null;
  return (
    <>
      <ListRow label="한 번에 쓸 수 있는 돈" value={formatOkrw(parseAokrw(budget.perOrderLimit))} />
      <ListRow
        label="30일 한도"
        value={
          <AmountRatio
            value={parseAokrw(budget.chainUsed)}
            max={parseAokrw(budget.chainCap)}
            size="meter"
            valueUnit={false}
          />
        }
      />
      <ListRow label="이번 달 예산" value={formatOkrw(parseAokrw(budget.personalBudget))} />
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
