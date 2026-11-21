'use client';

import { formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import { DragonLine, ErrorLine, ListRow, Skeleton, TopBar } from '@sikyeoyong/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTransitionRouter } from '../../../lib/transition-router';
import { Fragment } from 'react';
import { OwnerApprovalContainer } from '../../approvals/containers/OwnerApprovalContainer';
import { useOwnerApprovals } from '../../approvals/hooks/useApprovals';
import { cardsToShow } from '../../approvals/owner';
import { handQuoteToChat } from '../../chat/hooks/useChat';
import { useMe } from '../../me/hooks/useMe';
import { historyLabel, orderHref } from '../active';
import { orderKey } from '../hooks/useOrder';
import { useOrders } from '../hooks/useOrders';

/**
 * 주문 내역 (Main.dc.html receipt button). The design has no list screen yet, so this is the
 * simplest list from existing parts (web.md "ui에 없는 것"): one ListRow per order, newest
 * first, the amount on the right. A press opens its status screen, its receipt or the limit
 * screen; rows with nothing to open are not pressable (orderHref).
 */
export function OrderHistoryContainer() {
  const router = useTransitionRouter();
  const qc = useQueryClient();
  const me = useMe().data;
  const orders = useOrders();
  const list = orders.data?.orders;
  const approvals = cardsToShow(useOwnerApprovals().data ?? [], list);
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
          {list.map((o) => {
            const href = orderHref(o, me ? parseAokrw(me.perOrderLimit) : undefined);
            const approval = approvals.find((a) => a.orderId === o.id);
            // A row with no screen to open is not pressable and has no arrow.
            const row =
              href === undefined ? (
                <ListRow label={historyLabel(o)} value={formatOkrw(parseAokrw(o.amount))} />
              ) : (
                <ListRow
                  label={historyLabel(o)}
                  value={formatOkrw(parseAokrw(o.amount))}
                  trailing="chevron"
                  onPress={() => {
                    qc.setQueryData(orderKey(o.id), o);
                    router.push(href);
                  }}
                />
              );
            return (
              <Fragment key={o.id}>
                {row}
                {/* An order waiting for the owner carries its yes-or-no card. After a yes the
                    order is quoted again and the chat opens with its confirm sheet. */}
                {approval ? (
                  <OwnerApprovalContainer
                    approval={approval}
                    onQuote={(quote) => {
                      handQuoteToChat(qc, quote);
                      router.push('/');
                    }}
                  />
                ) : null}
              </Fragment>
            );
          })}
        </>
      )}
    </>
  );
}
