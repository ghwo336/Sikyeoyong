import { CHAT_SESSION_IDLE_MS } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import type { ChatHistoryMessage, OrderStatus, OrderView } from '../../../lib/api';
import {
  greetingFor,
  mealSlot,
  pastLines,
  pastSessions,
  sessionEnded,
  sessionLabel,
  splitSessions,
  type MessageGroup,
} from './sessions';

// 2026-11-21 18:30 KST is 09:30 UTC.
const EVENING = Date.UTC(2026, 10, 21, 9, 30);

const user = (id: string, sessionId?: string, createdAt?: number): ChatHistoryMessage => ({
  id,
  role: 'user',
  text: '시켜 줘',
  ...(sessionId === undefined ? {} : { sessionId }),
  ...(createdAt === undefined ? {} : { createdAt }),
});

const quote = (orderId: string) =>
  ({
    orderId,
    store: '마루국밥',
    items: [{ name: '돼지국밥', quantity: 1, price: '9000000000000000000000' }],
    amount: '9000000000000000000000',
  }) as never;

const dragon = (
  id: string,
  events: Extract<ChatHistoryMessage, { role: 'dragon' }>['events'],
  sessionId?: string,
  createdAt?: number,
): ChatHistoryMessage => ({
  id,
  role: 'dragon',
  events,
  ...(sessionId === undefined ? {} : { sessionId }),
  ...(createdAt === undefined ? {} : { createdAt }),
});

function only(groups: readonly MessageGroup[]): MessageGroup {
  const g = groups[0];
  if (!g) throw new Error('no group');
  return g;
}

const order = (id: string, status: OrderStatus) => ({ id, status }) as OrderView;

describe('splitSessions', () => {
  it('groups messages by session id in order, old messages without an id as one group', () => {
    const groups = splitSessions([
      user('a'),
      user('b'),
      user('c', 's1'),
      user('d', 's1'),
      user('e', 's2'),
    ]);
    expect(groups.map((g) => [g.id, g.messages.length])).toEqual([
      ['legacy', 2],
      ['s1', 2],
      ['s2', 1],
    ]);
  });

  it('is empty for no messages', () => {
    expect(splitSessions([])).toEqual([]);
  });
});

describe('meal slot, label and greeting', () => {
  it('names the meal from the Seoul hour', () => {
    expect(mealSlot(Date.UTC(2026, 10, 21, 0, 0))).toBe('아침'); // 09:00
    expect(mealSlot(Date.UTC(2026, 10, 21, 3, 0))).toBe('점심'); // 12:00
    expect(mealSlot(EVENING)).toBe('저녁');
    expect(mealSlot(Date.UTC(2026, 10, 21, 15, 0))).toBe('야식'); // 00:00 next day
  });

  it('labels the date line like "11월 21일 저녁", and "지난 대화" with no time', () => {
    expect(sessionLabel(EVENING)).toBe('11월 21일 저녁');
    expect(sessionLabel(undefined)).toBe('지난 대화');
  });

  it('greets by the meal of the moment', () => {
    expect(greetingFor(EVENING)).toBe('저녁 시켜 줄까용?');
  });
});

describe('pastLines', () => {
  const picked = only(
    splitSessions([
      user('u', 's1'),
      dragon('d', [{ type: 'order_confirm', quote: quote('o1') }], 's1'),
    ]),
  );

  it('sums up a quoted order with its status, as text', () => {
    expect(pastLines(picked, [order('o1', 'delivered')])).toEqual(['돼지국밥 9,000원, 도착함']);
    expect(pastLines(picked, [order('o1', 'cancelled')])).toEqual(['돼지국밥 9,000원, 취소함']);
  });

  it('leaves the status off when the order is not in the list, and marks an unpaid quote', () => {
    expect(pastLines(picked, [])).toEqual(['돼지국밥 9,000원']);
    expect(pastLines(picked, [order('o1', 'quoted')])).toEqual(['돼지국밥 9,000원, 주문하지 않음']);
  });

  it('sums up recommendations nobody picked from, once per list', () => {
    const rec = (id: string) =>
      ({ id, menu: '돼지국밥', price: '9000000000000000000000' }) as never;
    const g = only(
      splitSessions([
        dragon(
          'd',
          [
            { type: 'recommendations', items: [rec('a'), rec('b'), rec('c')] },
            { type: 'recommendations', items: [rec('a'), rec('b'), rec('c')] },
          ],
          's1',
        ),
      ]),
    );
    expect(pastLines(g, [])).toEqual(['돼지국밥 9,000원 외 2곳, 고르지 않음']);
  });

  it('draws no recommendation line when an order came out of the conversation', () => {
    const rec = { id: 'a', menu: '순대국', price: '9000000000000000000000' } as never;
    const g = only(
      splitSessions([
        dragon('d', [{ type: 'recommendations', items: [rec] }], 's1'),
        dragon('e', [{ type: 'order_confirm', quote: quote('o1') }], 's1'),
      ]),
    );
    expect(pastLines(g, [order('o1', 'delivered')])).toEqual(['돼지국밥 9,000원, 도착함']);
  });
});

describe('pastSessions', () => {
  it('keeps date lines in order and leaves out a conversation with no card', () => {
    const groups = splitSessions([
      user('a', 's0', EVENING - 86_400_000),
      user('b', 's1', EVENING),
      dragon('c', [{ type: 'order_confirm', quote: quote('o1') }], 's1', EVENING),
    ]);
    expect(pastSessions(groups, [order('o1', 'delivered')])).toEqual([
      { id: 's1', label: '11월 21일 저녁', lines: ['돼지국밥 9,000원, 도착함'] },
    ]);
  });
});

describe('sessionEnded', () => {
  const g = (createdAt?: number) =>
    only(
      splitSessions([
        user('u', 's1', createdAt),
        dragon('d', [{ type: 'order_confirm', quote: quote('o1') }], 's1', createdAt),
      ]),
    );

  it('is over once the last order has ended', () => {
    expect(sessionEnded(g(), [order('o1', 'delivered')], EVENING)).toBe(true);
    expect(sessionEnded(g(), [order('o1', 'failed')], EVENING)).toBe(true);
  });

  it('stays on while the order is on its way or not yet paid', () => {
    expect(sessionEnded(g(), [order('o1', 'delivering')], EVENING)).toBe(false);
    expect(sessionEnded(g(), [order('o1', 'quoted')], EVENING)).toBe(false);
  });

  it('is over after the idle limit, and not before it', () => {
    expect(sessionEnded(g(EVENING), [], EVENING + CHAT_SESSION_IDLE_MS + 1)).toBe(true);
    expect(sessionEnded(g(EVENING), [], EVENING + CHAT_SESSION_IDLE_MS - 1)).toBe(false);
  });
});
