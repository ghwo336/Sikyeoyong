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
  /** The order the dragon placed that now waits for the owner (approval_request). */
  readonly approval: { readonly orderId: string; readonly reason: string } | undefined;
}

/**
 * One dragon message: tokens join into one line, then cards in the order they came. A limit
 * change card goes after the turn's words (before its reply chips): the model often explains
 * the card after the tool call, and once the card is pressed it becomes the "바꿨어용!" line,
 * which must read as the newest thing, not sit above "아직 바뀌지 않았어용" (browser QA 2).
 */
export function dragonTurn(messageId: string, events: readonly ChatEvent[]): DragonTurn {
  const entries: ChatEntry[] = [];
  const limitCards: ChatEntry[] = [];
  let text = '';
  let cardBreak = false;
  let quote: OrderQuote | undefined;
  let approval: DragonTurn['approval'];
  // The model may look the same list up twice in one turn; the thread shows it once (QA 3).
  const seenLists = new Set<string>();
  const flushText = () => {
    if (text === '') return;
    entries.push({ kind: 'dragon', id: `${messageId}-t${String(entries.length)}`, text });
    text = '';
  };
  for (const e of events) {
    switch (e.type) {
      case 'token':
        // Words on both sides of a limit card stay one line, broken where the card was.
        if (cardBreak && text !== '' && e.text !== '') text += '\n';
        cardBreak = false;
        text += e.text;
        break;
      case 'recommendations': {
        const key = e.items.map((i) => i.id).join('|');
        if (seenLists.has(key)) break;
        seenLists.add(key);
        flushText();
        entries.push({
          kind: 'recommendations',
          id: `${messageId}-r${String(entries.length)}`,
          items: e.items,
        });
        break;
      }
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
      case 'approval_request':
        approval = { orderId: e.orderId, reason: e.reason };
        break;
      case 'limit_change_card':
        cardBreak = true;
        limitCards.push({ kind: 'limit_change', id: e.card.cardId, card: e.card });
        break;
      case 'done':
        break;
    }
  }
  flushText();
  let at = entries.length;
  while (at > 0 && entries[at - 1]?.kind === 'quick_replies') at -= 1;
  entries.splice(at, 0, ...limitCards);
  return { entries, quote, approval };
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
 * Rows the thread draws: a recommendations card rides with its dragon line, under the words
 * (Main.dc.html), whether the stream sent the card just after the line or just before it (a
 * turn that runs the tool first, like the replay and many Claude turns). Any other card
 * stands alone.
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
    if (entry.kind === 'recommendations' && next?.kind === 'dragon') {
      rows.push({ entry: next, cards: entry, last: i + 1 === entries.length - 1 });
      i++;
      continue;
    }
    rows.push({ entry, last: i === entries.length - 1 });
  }
  return rows;
}

/** Id prefix of a line the dragon says on this screen only (a reply to the user's own tap). */
export const LOCAL_LINE_PREFIX = 'local-';

/**
 * The id of the newest thing the user caused: their own message, or the dragon's on-screen
 * answer to their tap. When it changes, the thread follows to the bottom like a sent message
 * (browser QA 3: the reply to a tap while frozen stayed off screen).
 */
export function lastSent(entries: readonly ChatEntry[]): string | undefined {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const e = entries[i];
    if (e?.kind === 'user') return e.id;
    if (e?.kind === 'dragon' && e.id.startsWith(LOCAL_LINE_PREFIX)) return e.id;
  }
  return undefined;
}
