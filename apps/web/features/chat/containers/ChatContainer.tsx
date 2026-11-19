'use client';

import { parseAokrw } from '@sikyeoyong/shared';
import {
  ChatInput,
  ChatThread,
  DragonLine,
  QuickReplies,
  RecommendationList,
  UserBubble,
} from '@sikyeoyong/ui';
import { useState } from 'react';
import { minutes } from '../../../lib/format';
import { useMe } from '../../me/hooks/useMe';
import { OrderConfirmContainer } from '../../orders/containers/OrderConfirmContainer';
import { useCreateOrder } from '../../orders/hooks/useCreateOrder';
import type { ChatEntry } from '../hooks/entries';
import { useChat } from '../hooks/useChat';

/**
 * Main conversation: thread, recommendations, reply chips and the input (Main.dc.html).
 * A picked recommendation or a quote from the dragon opens the confirm sheet over the chat.
 */
export function ChatContainer() {
  const chat = useChat();
  const me = useMe().data;
  const createOrder = useCreateOrder();
  const [draft, setDraft] = useState('');
  const entries = chat.thread?.entries ?? [];

  function pick(entry: Extract<ChatEntry, { kind: 'recommendations' }>, id: string) {
    const rec = entry.items.find((r) => r.id === id);
    if (!rec || createOrder.isPending) return;
    createOrder.mutate(rec, {
      onSuccess: (res) => {
        // pending_approval has no quote yet: the approval card is not built (web.md).
        if (res.quote) chat.showQuote(res.quote);
      },
    });
  }

  if (!me) return null;
  return (
    <>
      <ChatThread stamp={chat.thread?.stamp} streaming={chat.sending}>
        {entries.map((e, i) => {
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
              return (
                <DragonLine key={e.id} text={e.text} layout="chat" species={me.dragonSpecies} />
              );
            case 'recommendations':
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
            case 'quick_replies': {
              // Chips belong to the latest turn only.
              if (i !== entries.length - 1) return null;
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
      </ChatThread>
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
      <OrderConfirmContainer
        quote={chat.quote}
        open={chat.quoteOpen}
        species={me.dragonSpecies}
        onClose={chat.closeQuote}
      />
    </>
  );
}
