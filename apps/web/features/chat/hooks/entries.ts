// Turns the server's ChatEvent list into the items the thread draws, in order.
// Kept free of React so the same code serves history, the mock and (later) the SSE stream.
import type {
  ChatEvent,
  ChatHistoryMessage,
  LimitChangeCardView,
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
    }
  | {
      /** LimitChat.dc.html: the change the dragon proposes; only its button changes it (D-21). */
      readonly kind: 'limit_change';
      readonly id: string;
      readonly card: LimitChangeCardView;
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
      case 'limit_change_card':
        flushText();
        entries.push({ kind: 'limit_change', id: e.card.cardId, card: e.card });
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

type RecommendationsEntry = Extract<ChatEntry, { kind: 'recommendations' }>;

export interface ThreadRow {
  readonly entry: ChatEntry;
  /** Recommendations the dragon handed over with this line, drawn under its words (Main). */
  readonly cards?: RecommendationsEntry;
  /** The newest row; reply chips belong to it only. */
  readonly last: boolean;
}

/**
 * Rows the thread draws: a recommendations card right after a dragon line rides with that line
 * (Main.dc.html puts it under the words, not at the screen edge). Any other card stands alone.
 */
export function threadRows(entries: readonly ChatEntry[]): ThreadRow[] {
  const rows: ThreadRow[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] as ChatEntry;
    const next = entries[i + 1];
    if (entry.kind === 'dragon' && next?.kind === 'recommendations') {
      rows.push({ entry, cards: next, last: i + 1 === entries.length - 1 });
      i++;
      continue;
    }
    rows.push({ entry, last: i === entries.length - 1 });
  }
  return rows;
}
