// Turns the server's ChatEvent list into the items the thread draws, in order.
// Kept free of React so the same code serves history, the mock and (later) the SSE stream.
import type {
  ChatEvent,
  ChatHistoryMessage,
  OrderQuote,
  QuickReplyItem,
  RecommendationCard,
} from '../../../lib/api';

export type UserEntryStatus = 'sending' | 'sent' | 'failed';

export type ChatEntry =
  | {
      readonly kind: 'user';
      readonly id: string;
      readonly text: string;
      readonly status: UserEntryStatus;
    }
  | { readonly kind: 'dragon'; readonly id: string; readonly text: string }
  | {
      readonly kind: 'recommendations';
      readonly id: string;
      readonly items: readonly RecommendationCard[];
    }
  | {
      readonly kind: 'quick_replies';
      readonly id: string;
      readonly items: readonly QuickReplyItem[];
    };

export interface DragonTurn {
  readonly entries: readonly ChatEntry[];
  /** The confirm card, if the dragon quoted an order. Only its button pays. */
  readonly quote: OrderQuote | undefined;
}

/** One dragon message: tokens join into one line, then cards in the order they came. */
export function dragonTurn(messageId: string, events: readonly ChatEvent[]): DragonTurn {
  const entries: ChatEntry[] = [];
  let text = '';
  let quote: OrderQuote | undefined;
  const flushText = () => {
    if (text === '') return;
    entries.push({ kind: 'dragon', id: `${messageId}-t${String(entries.length)}`, text });
    text = '';
  };
  for (const e of events) {
    switch (e.type) {
      case 'token':
        text += e.text;
        break;
      case 'recommendations':
        flushText();
        entries.push({
          kind: 'recommendations',
          id: `${messageId}-r${String(entries.length)}`,
          items: e.items,
        });
        break;
      case 'quick_replies':
        flushText();
        entries.push({
          kind: 'quick_replies',
          id: `${messageId}-q${String(entries.length)}`,
          items: e.items,
        });
        break;
      case 'order_confirm':
        quote = e.quote;
        break;
      case 'done':
        break;
    }
  }
  flushText();
  return { entries, quote };
}

export function historyEntries(messages: readonly ChatHistoryMessage[]): ChatEntry[] {
  return messages.flatMap((m): readonly ChatEntry[] =>
    m.role === 'user'
      ? [{ kind: 'user', id: m.id, text: m.text, status: 'sent' }]
      : dragonTurn(m.id, m.events).entries,
  );
}
