'use client';

import type { DragonSpecies } from '@sikyeoyong/shared';
import { ActionPair, Button, DragonLine, ErrorLine, ScreenTitle, TopBar } from '@sikyeoyong/ui';
import type { OrderView } from '../../../lib/api';
import { useTransitionRouter } from '../../../lib/transition-router';
import { canRetryFailed } from '../failed';
import { useRetryOrder } from '../hooks/useRetryOrder';

/**
 * A failed order's status screen: nothing was spent, so no progress. The dragon says why (the
 * server's line for the order's error code), then the one next step: the same order again when
 * the server allows it (D-19), otherwise back to the chat to pick again.
 */
export function FailedOrderContainer({
  order,
  species,
}: {
  readonly order: OrderView;
  readonly species: DragonSpecies;
}) {
  const router = useTransitionRouter();
  const retry = useRetryOrder(order.id);
  const toChat = () => {
    router.push('/');
  };
  return (
    <>
      <TopBar title="주문 현황" backLabel="대화로 돌아가기" onBack={toChat} />
      <ScreenTitle variant="title" title="주문이 멈췄어요" />
      <DragonLine
        text={order.dragonLine}
        mood={order.dragonMood}
        layout="inline"
        species={species}
      />
      {retry.isError && <ErrorLine>다시 시도하지 못했어요. 잠시 뒤에 눌러 주세요.</ErrorLine>}
      {canRetryFailed(order) ? (
        <ActionPair
          gap="md"
          primary={
            <Button
              variant="primary"
              loading={retry.isPending}
              onPress={() => {
                if (!retry.isPending) retry.mutate();
              }}
            >
              다시 시도하기
            </Button>
          }
          secondary={
            <Button variant="text" onPress={toChat}>
              대화로 돌아가기
            </Button>
          }
        />
      ) : (
        <Button variant="primary" onPress={toChat}>
          대화로 돌아가기
        </Button>
      )}
    </>
  );
}
