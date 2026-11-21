// D-34: the chat shows only this meal's conversation. Earlier ones fold above it, each as a
// date line and one-line summaries with no buttons. Pure code, no React.
import { CHAT_SESSION_IDLE_MS, formatOkrw, parseAokrw } from '@sikyeoyong/shared';
import type { ChatHistoryMessage, OrderStatus, OrderView } from '../../../lib/api';

/** A run of messages from one conversation, oldest first. */
export interface MessageGroup {
  readonly id: string;
  readonly messages: readonly ChatHistoryMessage[];
}

/** Messages stored before sessions carry no id; they fold together as one old conversation. */
const LEGACY = 'legacy';

/** Groups messages by session id, keeping order. A new id (or a gap back to an old one) starts a group. */
export function splitSessions(messages: readonly ChatHistoryMessage[]): MessageGroup[] {
  const groups: { id: string; messages: ChatHistoryMessage[] }[] = [];
  for (const m of messages) {
    const id = m.sessionId ?? LEGACY;
    const last = groups[groups.length - 1];
    if (last?.id === id) last.messages.push(m);
    else groups.push({ id, messages: [m] });
  }
  return groups;
}

const KST = 'Asia/Seoul';
const KST_HOUR = new Intl.DateTimeFormat('en-US', {
  timeZone: KST,
  hour: 'numeric',
  hourCycle: 'h23',
});
const KST_MONTH_DAY = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KST,
  month: 'numeric',
  day: 'numeric',
});

/** The meal a time of day belongs to (KST): 아침 5~10시, 점심 11~15시, 저녁 16~20시, 그 밖은 야식. */
export function mealSlot(unixMs: number): '아침' | '점심' | '저녁' | '야식' {
  const hour = Number(KST_HOUR.format(unixMs));
  if (hour >= 5 && hour <= 10) return '아침';
  if (hour >= 11 && hour <= 15) return '점심';
  if (hour >= 16 && hour <= 20) return '저녁';
  return '야식';
}

/** "11월 21일 저녁" over an earlier conversation; "지난 대화" when the server gave no time. */
export function sessionLabel(unixMs: number | undefined): string {
  if (unixMs === undefined) return '지난 대화';
  const part = (type: string) =>
    KST_MONTH_DAY.formatToParts(unixMs).find((p) => p.type === type)?.value ?? '';
  return `${part('month')}월 ${part('day')}일 ${mealSlot(unixMs)}`;
}

/** What the dragon says first in a new conversation, from the meal of the moment. */
export function greetingFor(unixMs: number): string {
  return `${mealSlot(unixMs)} 시켜 줄까용?`;
}

const STATUS_WORD: Record<OrderStatus, string> = {
  quoted: '주문하지 않음',
  pending_approval: '허락을 기다림',
  submitting: '주문 중',
  paid: '주문 중',
  preparing: '만드는 중',
  delivering: '배달 중',
  delivered: '도착함',
  failed: '주문 안 됨',
  cancelled: '취소함',
  refunded: '돌려받음',
};

const ENDED: ReadonlySet<OrderStatus> = new Set(['delivered', 'failed', 'cancelled', 'refunded']);

function quotesOf(group: MessageGroup) {
  const quotes = new Map<string, { menu: string; amount: string; more: number }>();
  for (const m of group.messages) {
    if (m.role !== 'dragon') continue;
    for (const e of m.events) {
      if (e.type !== 'order_confirm') continue;
      const first = e.quote.items[0];
      quotes.set(e.quote.orderId, {
        menu: first?.name ?? e.quote.store,
        amount: e.quote.amount,
        more: Math.max(0, e.quote.items.length - 1),
      });
    }
  }
  return quotes;
}

/**
 * One line per card of an earlier conversation: each quoted order as "돼지국밥 9,000원, 도착함"
 * (status from the order list, left off when the order is not in it), and the recommendations
 * the owner never picked from as "돼지국밥 9,000원 외 2곳, 고르지 않음". Text only (PastLine).
 */
export function pastLines(group: MessageGroup, orders: readonly OrderView[]): string[] {
  const lines: string[] = [];
  const quotes = quotesOf(group);
  for (const [orderId, q] of quotes) {
    const name = q.more > 0 ? `${q.menu} 외 ${String(q.more)}개` : q.menu;
    const status = orders.find((o) => o.id === orderId)?.status;
    const base = `${name} ${formatOkrw(parseAokrw(q.amount))}`;
    lines.push(status === undefined ? base : `${base}, ${STATUS_WORD[status]}`);
  }
  if (quotes.size > 0) return lines;
  const seen = new Set<string>();
  for (const m of group.messages) {
    if (m.role !== 'dragon') continue;
    for (const e of m.events) {
      if (e.type !== 'recommendations') continue;
      const first = e.items[0];
      if (!first) continue;
      const key = e.items.map((i) => i.id).join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const more = e.items.length - 1;
      lines.push(
        `${first.menu} ${formatOkrw(parseAokrw(first.price))}${more > 0 ? ` 외 ${String(more)}곳` : ''}, 고르지 않음`,
      );
    }
  }
  return lines;
}

/** When a conversation began, if the server told: its first message's time. */
export function startedAtOf(group: MessageGroup): number | undefined {
  return group.messages.find((m) => m.createdAt !== undefined)?.createdAt;
}

/**
 * Whether a conversation is over, so the next thing the user sees is a new meal's greeting
 * (the server opens a new session the same way): its last order has ended, or the last message
 * is older than the idle limit. With no time from the server only the order rule applies.
 */
export function sessionEnded(
  group: MessageGroup,
  orders: readonly OrderView[],
  now: number,
): boolean {
  const lastAt = group.messages[group.messages.length - 1]?.createdAt;
  if (lastAt !== undefined && now - lastAt > CHAT_SESSION_IDLE_MS) return true;
  const ids = [...quotesOf(group).keys()];
  const lastId = ids[ids.length - 1];
  if (lastId === undefined) return false;
  const status = orders.find((o) => o.id === lastId)?.status;
  return status !== undefined && ENDED.has(status);
}

export interface PastSession {
  readonly id: string;
  readonly label: string;
  readonly lines: readonly string[];
}

/** The folded view of earlier conversations. One with no card to recall is left out. */
export function pastSessions(
  groups: readonly MessageGroup[],
  orders: readonly OrderView[],
): PastSession[] {
  return groups.flatMap((g) => {
    const lines = pastLines(g, orders);
    return lines.length === 0 ? [] : [{ id: g.id, label: sessionLabel(startedAtOf(g)), lines }];
  });
}
