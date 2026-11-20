'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import { DragonLine, LimitBlocked, TopBar } from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { useBudget } from '../../budget/hooks/useBudget';
import { useMe } from '../../me/hooks/useMe';
import { useOrder } from '../../orders/hooks/useOrder';
import { levelFor } from '../levels';

/** Blocked.dc.html: the order is over what the dragon may spend at once. Raise, or pick again. */
export function BlockedContainer({ orderId }: { readonly orderId: string }) {
  const router = useRouter();
  const me = useMe().data;
  const budget = useBudget().data;
  const { data: order } = useOrder(orderId);
  const back = () => {
    router.push('/');
  };
  if (!me || !budget || !order) return <TopBar onBack={back} backLabel="대화로 돌아가기" />;
  const attempted = parseAokrw(order.amount);
  const next = levelFor(attempted);
  const menu = order.items[0]?.name ?? '이 메뉴';
  return (
    <>
      <TopBar onBack={back} backLabel="대화로 돌아가기" />
      <DragonLine
        text={`앗, ${menu}는\n제가 한 번에 쓸 수 있는 돈보다 커용.`}
        mood="worried"
        layout="inline"
        species={me.dragonSpecies}
      />
      <LimitBlocked
        attempted={attempted}
        limit={parseAokrw(budget.perOrderLimit)}
        {...(next === undefined ? {} : { nextLevel: next })}
        onRaise={() => {
          router.push(`/limit/${encodeURIComponent(orderId)}/raise`);
        }}
        onRepick={back}
      />
    </>
  );
}
