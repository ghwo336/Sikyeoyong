'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
  const [quote, setQuote] = useState<OrderQuote | undefined>(undefined);

  const update = (fn: (entries: readonly ChatEntry[]) => readonly ChatEntry[]) => {
    qc.setQueryData<ChatThreadData>(THREAD_KEY, (old) =>
      old ? { ...old, entries: fn(old.entries) } : old,
    );
  };
  const setStatus = (id: string, status: 'sent' | 'failed') => {
    update((es) => es.map((e) => (e.kind === 'user' && e.id === id ? { ...e, status } : e)));
  };

  const send = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      api.sendChatMessage({ text, clientMessageId: id }),
    onSuccess: (events, { id }) => {
      setStatus(id, 'sent');
      const turn = dragonTurn(`reply-${id}`, events);
      update((es) => [...es, ...turn.entries]);
      if (turn.quote) setQuote(turn.quote);
    },
    onError: (_err, { id }) => {
      setStatus(id, 'failed');
    },
  });

  return {
    thread: thread.data,
    loading: thread.isPending,
    sending: send.isPending,
    send(text: string) {
      const id = crypto.randomUUID();
      update((es) => [...es, { kind: 'user', id, text, status: 'sending' }]);
      send.mutate({ id, text });
    },
    /** Sends a failed message again with the same id (the server can tell it is a repeat). */
    retry(id: string) {
      const entry = thread.data?.entries.find((e) => e.kind === 'user' && e.id === id);
      if (entry?.kind !== 'user') return;
      update((es) => es.map((e) => (e.id === id ? { ...entry, status: 'sending' } : e)));
      send.mutate({ id, text: entry.text });
    },
    quote,
    showQuote: setQuote,
    closeQuote() {
      setQuote(undefined);
    },
  };
}
