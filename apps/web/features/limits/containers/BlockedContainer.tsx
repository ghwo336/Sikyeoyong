'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { DragonLine, LimitBlocked, TopBar } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useBudget } from '../../budget/hooks/useBudget';
import { useMe } from '../../me/hooks/useMe';
import { useOrder } from '../../orders/hooks/useOrder';
import { withEunNeun } from '../../../lib/format';
import { limitToFit } from '../fit';
import { useBackToChat } from '../hooks/useBackToChat';

/** Blocked.dc.html: the order is over what the dragon may spend at once. Raise, or pick again. */
export function BlockedContainer({ orderId }: { readonly orderId: string }) {
  const router = useRouter();
  const me = useMe().data;
  const budget = useBudget().data;
  const orderQuery = useOrder(orderId);
  const order = orderQuery.data;
  const back = () => {
    router.push('/');
  };
  // An old link: the order is gone, or it fits the limit now (raised, or waiting for another
  // reason, which is the owner's approval and not a raise).
  const fits =
    order !== undefined &&
    budget !== undefined &&
    parseAokrw(order.amount) <= parseAokrw(budget.perOrderLimit);
  useBackToChat(orderQuery.isError || fits);
  if (!me || !budget || !order) return <TopBar onBack={back} backLabel="대화로 돌아가기" />;
  const attempted = parseAokrw(order.amount);
  const limit = parseAokrw(budget.perOrderLimit);
  // Only an order over the per-order limit belongs here; other waits (a new store, the budget)
  // are the owner's approval, not a limit raise.
  if (attempted <= limit) return <TopBar onBack={back} backLabel="대화로 돌아가기" />;
  const raiseTo = limitToFit(attempted);
  const menu = order.items[0]?.name ?? '이 메뉴';
  return (
    <>
      <TopBar onBack={back} backLabel="대화로 돌아가기" />
      <DragonLine
        text={`앗, ${withEunNeun(menu)}\n제가 한 번에 쓸 수 있는 돈보다 커용.`}
        mood="worried"
        layout="inline"
        species={me.dragonSpecies}
      />
      <LimitBlocked
        attempted={attempted}
        limit={limit}
        {...(raiseTo === undefined ? {} : { raiseTo })}
        onRaise={() => {
          router.push(`/limit/${encodeURIComponent(orderId)}/raise`);
        }}
        onRepick={back}
      />
    </>
  );
}
