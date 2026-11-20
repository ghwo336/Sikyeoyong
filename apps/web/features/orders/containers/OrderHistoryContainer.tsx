'use client';

import { formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import { DragonLine, ErrorLine, ListRow, Skeleton, TopBar } from '@sikyeoyong/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMe } from '../../me/hooks/useMe';
import { historyLabel, orderHref } from '../active';
import { orderKey } from '../hooks/useOrder';
import { useOrders } from '../hooks/useOrders';

/**
 * 주문 내역 (Main.dc.html receipt button). The design has no list screen yet, so this is the
 * simplest list from existing parts (web.md "ui에 없는 것"): one ListRow per order, newest
 * first, the amount on the right. A press opens its status screen or its receipt.
 */
export function OrderHistoryContainer() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe().data;
  const orders = useOrders();
  const list = orders.data?.orders;
  return (
    <>
      <TopBar
        title="주문 내역"
        backLabel="대화로 돌아가기"
        onBack={() => {
          router.push('/');
        }}
      />
      {list === undefined && orders.isError ? (
        <ErrorLine>주문 내역을 못 불러왔어요. 잠시 뒤에 다시 열어 주세요.</ErrorLine>
      ) : list === undefined ? (
        // The shape of two rows while it loads (D-23: no blank screen, no spinner).
        <>
          <Skeleton height="caption" width="60%" data-part="skeleton" />
          <Skeleton height="caption" width="45%" data-part="skeleton" />
        </>
      ) : list.length === 0 ? (
        me ? (
          <DragonLine text="아직 시킨 게 없어용." layout="chat" species={me.dragonSpecies} />
        ) : null
      ) : (
        <>
          {list.map((o) => (
            <ListRow
              key={o.id}
              label={historyLabel(o)}
              value={formatOkrw(parseAokrw(o.amount))}
              trailing="chevron"
              onPress={() => {
                qc.setQueryData(orderKey(o.id), o);
                router.push(orderHref(o));
              }}
            />
          ))}
        </>
      )}
    </>
  );
}
