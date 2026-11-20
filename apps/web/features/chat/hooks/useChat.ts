'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { ChatEvent } from '@sikyeoyong/shared';
import { api, type OrderQuote } from '../../../lib/api';
import { chatStamp } from '../../../lib/format';
import { type ChatEntry, dragonTurn, historyEntries } from './entries';

export interface ChatThreadData {
  /** "오늘 오후 12:28", made when the history arrives. */
  readonly stamp: string;
  readonly entries: readonly ChatEntry[];
}

const THREAD_KEY = ['chat', 'thread'] as const;

/**
 * Today's conversation and sending to the dragon (GET /chat/history, POST /chat/messages).
 * The thread lives in the query cache so it survives a trip to the order screen and back.
 * The confirm card the dragon quotes is held here until the sheet is closed; nothing here pays.
 */
export function useChat() {
  const qc = useQueryClient();
  const thread = useQuery({
    queryKey: THREAD_KEY,
    queryFn: async (): Promise<ChatThreadData> => {
      const h = await api.getChatHistory();
      return {
        stamp: chatStamp(h.startedAt, Date.now()),
        entries: historyEntries(h.messages),
      };
    },
    staleTime: Infinity,
  });
  // The last quote stays after closing so the sheet can slide down with its content.
  const [quote, setQuote] = useState<OrderQuote | undefined>(undefined);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const showQuote = (q: OrderQuote) => {
    setQuote(q);
    setQuoteOpen(true);
  };

  const update = (fn: (entries: readonly ChatEntry[]) => readonly ChatEntry[]) => {
    qc.setQueryData<ChatThreadData>(THREAD_KEY, (old) =>
      old ? { ...old, entries: fn(old.entries) } : old,
    );
  };
  const setStatus = (id: string, status: 'sent' | 'failed') => {
    update((es) => es.map((e) => (e.kind === 'user' && e.id === id ? { ...e, status } : e)));
  };

  // The reply being written: its entries replace themselves as events arrive (D-23).
  const [writing, setWriting] = useState<{ id: string; shown: boolean } | undefined>(undefined);
  // Which entries each reply drew so far: the next draw replaces exactly those (a card keeps
  // its own id, so a prefix would miss it).
  const drawn = useRef(new Map<string, ReadonlySet<string>>());
  const showTurn = (id: string, events: readonly ChatEvent[]) => {
    const turn = dragonTurn(`reply-${id}`, events);
    const before = drawn.current.get(id) ?? new Set<string>();
    drawn.current.set(id, new Set(turn.entries.map((e) => e.id)));
    update((es) => [...es.filter((e) => !before.has(e.id)), ...turn.entries]);
    return turn;
  };

  const send = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => {
      const sofar: ChatEvent[] = [];
      setWriting({ id, shown: false });
      return api.sendChatMessage({ text, clientMessageId: id }, (e) => {
        sofar.push(e);
        const turn = showTurn(id, sofar);
        if (turn.entries.length > 0) setWriting({ id, shown: true });
      });
    },
    onSuccess: (events, { id }) => {
      setStatus(id, 'sent');
      const turn = showTurn(id, events);
      if (turn.quote) showQuote(turn.quote);
    },
    onError: (_err, { id }) => {
      setStatus(id, 'failed');
    },
    onSettled: (_r, _e, { id }) => {
      drawn.current.delete(id);
      setWriting(undefined);
    },
  });

  return {
    thread: thread.data,
    loading: thread.isPending,
    sending: send.isPending,
    /** Sent and nothing of the answer on screen yet: the dragon is writing (typing dots). */
    typing: send.isPending && writing?.shown !== true,
    send: (text: string) => {
      const id = crypto.randomUUID();
      update((es) => [...es, { kind: 'user', id, text, status: 'sending' }]);
      send.mutate({ id, text });
    },
    /** Sends a failed message again with the same id (the server can tell it is a repeat). */
    retry: (id: string) => {
      const entry = thread.data?.entries.find((e) => e.kind === 'user' && e.id === id);
      if (entry?.kind !== 'user') return;
      update((es) => es.map((e) => (e.id === id ? { ...entry, status: 'sending' } : e)));
      send.mutate({ id, text: entry.text });
    },
    quote,
    quoteOpen,
    showQuote,
    closeQuote: () => {
      setQuoteOpen(false);
    },
  };
}
