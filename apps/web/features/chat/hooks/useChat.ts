'use client';

import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { ChatEvent } from '@sikyeoyong/shared';
import { api, type OrderQuote, type OrderView } from '../../../lib/api';
import { chatStamp } from '../../../lib/format';
import { APPROVALS_KEY } from '../../approvals/hooks/useApprovals';
import { ORDERS_KEY } from '../../orders/hooks/useOrders';
import { type ChatEntry, dragonTurn, historyEntries, LOCAL_LINE_PREFIX } from './entries';
import { greetingFor, type MessageGroup, sessionEnded, splitSessions } from './sessions';

/** Id prefix of the dragon's first line of a new meal, drawn on this screen only (D-34). */
export const GREETING_PREFIX = 'greeting-';

export interface ChatThreadData {
  /** "오늘 오후 12:28", made when the history arrives. */
  readonly stamp: string;
  /** The current conversation (this meal), drawn in full. */
  readonly entries: readonly ChatEntry[];
  /** Earlier conversations, oldest first. Folded into one-line summaries (D-34). */
  readonly earlier: readonly MessageGroup[];
  /** The conversation from the server that `entries` came from, until a new meal replaces it. */
  readonly latest: MessageGroup | undefined;
  /** Whether it was decided yet if this opens as a new meal (openSession). */
  readonly opened: boolean;
}

const THREAD_KEY = ['chat', 'thread'] as const;
const HANDOFF_KEY = ['chat', 'handoff'] as const;
const OPEN_QUOTE_KEY = ['chat', 'open-quote'] as const;

/**
 * Another screen hands the chat a confirm card to open on arrival: the order quoted again after
 * the owner raised the per-order limit (Blocked, user-flow 12 "O -> I"). Opening it pays nothing.
 */
export function handQuoteToChat(qc: QueryClient, quote: OrderQuote): void {
  qc.setQueryData(HANDOFF_KEY, quote);
}

/**
 * Today's conversation and sending to the dragon (GET /chat/history, POST /chat/messages).
 * The thread lives in the query cache so it survives a trip to the order screen and back.
 * The confirm card the dragon quotes is held here until the sheet is closed; nothing here pays.
 */
export function useChat(
  on: {
    /** The dragon placed an order that waits for the owner (reason as the server says). */
    readonly onApprovalRequest?: (a: { orderId: string; reason: string }) => void;
  } = {},
) {
  const qc = useQueryClient();
  const thread = useQuery({
    queryKey: THREAD_KEY,
    queryFn: async (): Promise<ChatThreadData> => {
      const h = await api.getChatHistory();
      const groups = splitSessions(h.messages);
      const latest = groups[groups.length - 1];
      return {
        stamp: chatStamp(h.startedAt, Date.now()),
        entries: latest ? historyEntries(latest.messages) : [],
        earlier: groups.slice(0, -1),
        latest,
        opened: false,
      };
    },
    staleTime: Infinity,
  });
  // The last quote stays after closing so the sheet can slide down with its content.
  // A card handed over by another screen opens with the chat (handQuoteToChat), once.
  const [quote, setQuote] = useState<OrderQuote | undefined>(() =>
    qc.getQueryData<OrderQuote>(HANDOFF_KEY),
  );
  const [quoteOpen, setQuoteOpen] = useState(() => quote !== undefined);
  useEffect(() => {
    qc.removeQueries({ queryKey: HANDOFF_KEY });
  }, [qc]);
  const showQuote = (q: OrderQuote) => {
    setQuote(q);
    setQuoteOpen(true);
  };
  // After a reload the server still holds the card the owner had not pressed yet (unexpired,
  // unpaid). Bring it back once; the sheet only opens, paying stays its button (rule 3).
  const open = useQuery({
    queryKey: OPEN_QUOTE_KEY,
    queryFn: () => api.getOpenQuote(),
    staleTime: Infinity,
    retry: false,
  });
  const reopened = open.data?.quote;
  useEffect(() => {
    if (reopened === undefined) return;
    // Spent either way: a card picked meanwhile wins, and a later visit must not reopen it.
    qc.setQueryData(OPEN_QUOTE_KEY, {});
    if (quote === undefined) showQuote(reopened);
  }, [reopened]);

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
        // Any event means the server took the message; do not wait for the stream to end.
        if (sofar.length === 1) setStatus(id, 'sent');
        const turn = showTurn(id, sofar);
        if (turn.entries.length > 0) setWriting({ id, shown: true });
      });
    },
    onSuccess: (events, { id }) => {
      setStatus(id, 'sent');
      const turn = showTurn(id, events);
      if (turn.quote) showQuote(turn.quote);
      if (turn.approval) {
        // The waiting order's card must show now, not after the next poll.
        void qc.invalidateQueries({ queryKey: APPROVALS_KEY });
        void qc.invalidateQueries({ queryKey: ORDERS_KEY });
        on.onApprovalRequest?.(turn.approval);
      }
    },
    onError: (_err, { id }) => {
      setStatus(id, 'failed');
    },
    onSettled: (_r, _e, { id }) => {
      drawn.current.delete(id);
      setWriting(undefined);
    },
  });

  /**
   * Decides once whether this opens as a new meal (D-34): no history yet, or the last
   * conversation is over (its order ended, or it went idle). The dragon then greets first and
   * the old conversation folds above. Shown on this screen only, never sent to the model.
   */
  const openSession = (orders: readonly OrderView[], now: number) => {
    qc.setQueryData<ChatThreadData>(THREAD_KEY, (old) => {
      if (!old || old.opened) return old;
      if (old.latest && !sessionEnded(old.latest, orders, now)) return { ...old, opened: true };
      const greeting: ChatEntry = {
        kind: 'dragon',
        id: `${GREETING_PREFIX}${String(now)}`,
        text: greetingFor(now),
      };
      return {
        ...old,
        opened: true,
        earlier: old.latest ? [...old.earlier, old.latest] : old.earlier,
        latest: undefined,
        entries: [greeting],
      };
    });
  };

  return {
    openSession,
    thread: thread.data,
    /** The history could not be read: the screen says so with a retry, never an empty screen. */
    historyFailed: thread.isError && thread.data === undefined,
    reloadHistory: () => {
      void thread.refetch();
    },
    loading: thread.isPending,
    sending: send.isPending,
    /** Sent and nothing of the answer on screen yet: the dragon is writing (typing dots). */
    typing: send.isPending && writing?.shown !== true,
    send: (text: string) => {
      const id = crypto.randomUUID();
      update((es) => [...es, { kind: 'user', id, text, status: 'sending' }]);
      send.mutate({ id, text });
    },
    /**
     * A line the dragon says on this screen only, with no model turn: the answer to a tap the
     * server refused (a sleeping dragon). Not stored; the history does not have it.
     */
    say: (text: string) => {
      update((es) => [
        ...es,
        { kind: 'dragon', id: `${LOCAL_LINE_PREFIX}${crypto.randomUUID()}`, text },
      ]);
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
