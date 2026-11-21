'use client';

import { formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import {
  Button,
  DragonLine,
  ListRow,
  Meter,
  ScreenTitle,
  TasteRating,
  TopBar,
} from '@sikyeoyong/ui';
import { useTransitionRouter } from '../../../lib/transition-router';
import { useState } from 'react';
import type { OrderView } from '../../../lib/api';
import { useBudget } from '../../budget/hooks/useBudget';
import { BUDGET_TONE } from '../../budget/tone';
import { useMe } from '../../me/hooks/useMe';
import { useWallet } from '../../wallet/hooks/useWallet';
import { useRateOrder } from '../hooks/useOrder';

/** Arrived.dc.html: it is here, this month's spend, saved money, how was it, the receipt. */
export function ArrivedContainer({ order }: { readonly order: OrderView }) {
  const router = useTransitionRouter();
  const me = useMe().data;
  const budget = useBudget().data;
  const wallet = useWallet().data;
  const rate = useRateOrder(order.id);
  const [picked, setPicked] = useState<'again' | 'okay' | 'meh' | undefined>(undefined);
  const menu = order.items[0]?.name ?? '오늘 메뉴';
  return (
    <>
      <TopBar
        title="주문 현황"
        backLabel="대화로 돌아가기"
        onBack={() => {
          router.push('/');
        }}
      />
      <ScreenTitle variant="title" title="도착했어요" />
      {me && (
        <DragonLine
          text={order.dragonLine}
          mood={order.dragonMood}
          layout="inline"
          species={me.dragonSpecies}
        />
      )}
      {budget && (
        <Meter
          label="30일 배달비"
          value={parseAokrw(budget.chainUsed)}
          max={parseAokrw(budget.myPeriodicLimit)}
          tone={BUDGET_TONE[budget.nagLevel]}
          size="md"
        />
      )}
      {wallet && (
        <ListRow
          label="이번 달 아낀 돈"
          value={formatOkrw(parseAokrw(wallet.savedThisMonth))}
          tone="accent"
        />
      )}
      <TasteRating
        menu={menu}
        value={picked}
        onPick={(v) => {
          setPicked(v);
          rate.mutate(v);
        }}
      />
      <Button
        variant="link"
        onPress={() => {
          router.push(`/orders/${encodeURIComponent(order.id)}/receipt`);
        }}
      >
        주문 상세 보기
      </Button>
    </>
  );
}
