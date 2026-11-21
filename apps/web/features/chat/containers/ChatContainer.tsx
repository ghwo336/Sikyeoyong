'use client';

import { AppError, parseAokrw, renderDragonLine } from '@sikyeoyong/shared';
import {
  ChatInput,
  ChatLayout,
  ChatThread,
  DragonLine,
  QuickReplies,
  TypingIndicator,
  RecommendationList,
  UserBubble,
} from '@sikyeoyong/ui';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { minutes } from '../../../lib/format';
import { OwnerApprovalContainer } from '../../approvals/containers/OwnerApprovalContainer';
import { useOwnerApprovals } from '../../approvals/hooks/useApprovals';
import { useBudget } from '../../budget/hooks/useBudget';
import { LimitChangeContainer } from '../../limits/containers/LimitChangeContainer';
import { needsApprovalNow } from '../../limits/fit';
import { useMe } from '../../me/hooks/useMe';
import { OrderConfirmContainer } from '../../orders/containers/OrderConfirmContainer';
import { useCreateOrder } from '../../orders/hooks/useCreateOrder';
import { useOrders } from '../../orders/hooks/useOrders';
import { type ChatEntry, lastSent, threadRows } from '../hooks/entries';
import { useChat } from '../hooks/useChat';

type RecommendationsEntry = Extract<ChatEntry, { kind: 'recommendations' }>;

export interface ChatContainerProps {
  /** Top row of the chat (Main: the dragon header). */
  readonly header?: ReactNode;
  /** Under the top row (Main: the month's budget card). */
  readonly top?: ReactNode;
}

/**
 * Main conversation: thread, recommendations, reply chips and the input (Main.dc.html).
 * A picked recommendation or a quote from the dragon opens the confirm sheet over the chat.
 */
export function ChatContainer({ header, top }: ChatContainerProps) {
  const router = useRouter();
  const chat = useChat();
  const me = useMe().data;
  const budget = useBudget().data;
  // Main.dc.html's "오늘 저녁도 부탁해" assumes earlier orders; a first owner gets a plain ask.
  const ordered = (useOrders().data?.orders.length ?? 0) > 0;
  const createOrder = useCreateOrder();
  // Orders waiting for the owner's yes (new store, 30-day limit) get their card at the bottom.
  const approvals = useOwnerApprovals().data ?? [];
  const [draft, setDraft] = useState('');
  const entries = chat.thread?.entries ?? [];

  function pick(entry: RecommendationsEntry, id: string) {
    const rec = entry.items.find((r) => r.id === id);
    if (!rec || createOrder.isPending) return;
    // Frozen.dc.html: a sleeping dragon orders nothing; it says so instead of a silent tap.
    if (budget?.frozen === true) {
      chat.say(renderDragonLine('SERVER_FROZEN'));
      return;
    }
    createOrder.mutate(rec, {
      onSuccess: (res) => {
        if (res.quote) chat.showQuote(res.quote);
        // Over the dragon's per-order limit: the Blocked screen (user-flow 12). Other waits
        // (a new store, the 30-day limit) come back as the owner's approval card below.
        else if (
          res.order.status === 'pending_approval' &&
          parseAokrw(rec.price) > parseAokrw(me?.perOrderLimit ?? '0')
        ) {
          router.push(`/limit/${encodeURIComponent(res.order.id)}`);
        }
      },
      onError: (err) => {
        // The 30-day cap is used up: the Cap screen (user-flow 14).
        if (err instanceof AppError && err.code === 'CHAIN_PERIODIC_LIMIT')
          router.push('/limit/cap');
        // Frozen since the screen loaded (423): the same sleeping line.
        else if (
          err instanceof AppError &&
          (err.code === 'SERVER_FROZEN' || err.code === 'CHAIN_AGENT_PAUSED')
        )
          chat.say(renderDragonLine(err.code));
      },
    });
  }

  function recommendations(e: RecommendationsEntry) {
    return (
      <RecommendationList
        key={e.id}
        items={e.items.map((r) => ({
          id: r.id,
          store: r.store,
          eta: minutes(r.etaMin),
          menu: r.menu,
          price: parseAokrw(r.price),
          // Redrawn against the limits now: a raise clears 허락 필요 on older cards.
          needsApproval: budget ? needsApprovalNow(parseAokrw(r.price), budget) : r.needsApproval,
        }))}
        onPick={(id) => {
          pick(e, id);
        }}
      />
    );
  }

  const frozen = budget?.frozen === true;
  if (!me) return null;
  return (
    <>
      <ChatLayout
        header={header}
        top={top}
        footer={
          <ChatInput
            value={draft}
            onChange={setDraft}
            onSend={(text) => {
              chat.send(text);
              setDraft('');
            }}
            placeholder={
              frozen
                ? '깨우면 다시 말할 수 있어요'
                : ordered
                  ? '오늘 저녁도 부탁해'
                  : '뭐 먹고 싶은지 말해 줘'
            }
            sending={chat.sending}
            // Frozen.dc.html: while the dragon sleeps nothing is ordered, so nothing is sent.
            disabled={frozen}
            disabledNote="용이가 자고 있어요"
          />
        }
      >
        <ChatThread
          stamp={chat.thread?.stamp}
          streaming={chat.sending}
          // A card that arrives for the owner's pick scrolls into view like a sent message.
          followKey={`${lastSent(entries) ?? ''}|${approvals.map((a) => a.id).join(',')}`}
        >
          {threadRows(entries).map(({ entry: e, cards, last }) => {
            switch (e.kind) {
              case 'user':
                return (
                  <UserBubble
                    key={e.id}
                    text={e.text}
                    status={e.status}
                    onRetry={() => {
                      chat.retry(e.id);
                    }}
                  />
                );
              case 'dragon':
                // Main.dc.html: the card the dragon hands over sits under its words.
                return (
                  <DragonLine key={e.id} text={e.text} layout="chat" species={me.dragonSpecies}>
                    {cards ? recommendations(cards) : undefined}
                  </DragonLine>
                );
              case 'recommendations':
                return recommendations(e);
              case 'limit_change':
                return <LimitChangeContainer key={e.id} card={e.card} species={me.dragonSpecies} />;
              case 'quick_replies': {
                // Chips belong to the latest turn only.
                if (!last) return null;
                return (
                  <QuickReplies
                    key={e.id}
                    items={e.items}
                    onPick={(id) => {
                      const label = e.items.find((q) => q.id === id)?.label;
                      if (label !== undefined) chat.send(label);
                    }}
                  />
                );
              }
            }
          })}
          {approvals.map((a) => (
            <OwnerApprovalContainer
              key={a.id}
              approval={a}
              onQuote={chat.showQuote}
              onRejected={() => {
                chat.say('알겠어용. 안 시킬게용.');
              }}
            />
          ))}
          {/* Until the first words or card arrive, the dragon is visibly writing (D-23). */}
          {chat.typing ? <TypingIndicator species={me.dragonSpecies} /> : null}
        </ChatThread>
      </ChatLayout>
      <OrderConfirmContainer
        quote={chat.quote}
        open={chat.quoteOpen}
        species={me.dragonSpecies}
        onClose={chat.closeQuote}
      />
    </>
  );
}
