'use client';

import { AppError, parseAokrw } from '@sikyeoyong/shared';
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
import { LimitChangeContainer } from '../../limits/containers/LimitChangeContainer';
import { useMe } from '../../me/hooks/useMe';
import { OrderConfirmContainer } from '../../orders/containers/OrderConfirmContainer';
import { useCreateOrder } from '../../orders/hooks/useCreateOrder';
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
  const createOrder = useCreateOrder();
  const [draft, setDraft] = useState('');
  const entries = chat.thread?.entries ?? [];

  function pick(entry: RecommendationsEntry, id: string) {
    const rec = entry.items.find((r) => r.id === id);
    if (!rec || createOrder.isPending) return;
    createOrder.mutate(rec, {
      onSuccess: (res) => {
        if (res.quote) chat.showQuote(res.quote);
        // Over the dragon's per-order limit: the Blocked screen (user-flow 12). Other waits
        // (a new store, the budget) are the owner's approval card, not built yet (web.md).
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
          needsApproval: r.needsApproval,
        }))}
        onPick={(id) => {
          pick(e, id);
        }}
      />
    );
  }

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
            placeholder="오늘 저녁도 부탁해"
            sending={chat.sending}
          />
        }
      >
        <ChatThread
          stamp={chat.thread?.stamp}
          streaming={chat.sending}
          followKey={lastSent(entries)}
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
