import { describe, expect, it } from 'vitest';
import { DRAGON_MOODS } from '../domain/dragon-mood.js';
import { zChatEvent, zChatHistory, zChatHistoryQuery, zSendChatMessageBody } from './chat.js';
import { zAgentSetupView, zCreateAgentBody, zMeView, zSignupConfig } from './me.js';
import {
  ORDER_STATUSES,
  zCreateOrderBody,
  zCreateOrderResult,
  zOrderQuote,
  zOrderView,
} from './orders.js';

// tech-spec 2.4, 3.2. Amount strings are written by hand (9,000원 = 9000 * 10^18 aokrw).
const W9000 = '9000000000000000000000';
const W10000 = '10000000000000000000000';

const QUOTE = {
  orderId: 'o1',
  store: '마루국밥 본점',
  destination: '회사(역삼동)',
  etaMin: 25,
  items: [{ name: '돼지국밥', quantity: 1, price: W9000 }],
  request: '깍두기 많이',
  amount: W9000,
  dragonLine: '돼지국밥 시킬게용.\n이대로 괜찮아용?',
  perOrderLimit: W10000,
  periodUsedAfter: W9000,
  periodCap: '500000000000000000000000',
};

const REC = {
  id: 'r1',
  merchantId: 'm1',
  menuId: 'menu1',
  store: '마루국밥',
  etaMin: 25,
  menu: '돼지국밥',
  price: W9000,
  needsApproval: false,
};

describe('zChatEvent (tech-spec 2.4)', () => {
  it.each([
    { type: 'token', text: '비 오니까 국물이용!' },
    { type: 'tool_status', tool: 'recommend_merchants', state: 'start' },
    { type: 'recommendations', items: [REC] },
    { type: 'quick_replies', items: [{ id: 'q1', label: '다른 거' }] },
    { type: 'order_confirm', quote: QUOTE },
    { type: 'order_failed', code: 'CHAIN_AGENT_LIMIT', dragonLine: '한도를 넘었어용' },
    {
      type: 'limit_change_card',
      card: {
        cardId: 'c1',
        field: 'perOrder',
        from: W10000,
        to: '50000000000000000000000',
        levelFrom: 1,
        levelTo: 3,
        needsReauth: true,
        rows: [{ label: '30일 한도', value: '500,000원 그대로' }],
      },
    },
    { type: 'nag', level: 'warn70', message: '주말엔 집밥 어때용?', spent: W9000, budget: W10000 },
    { type: 'done', messageId: 'm1' },
  ])('accepts $type', (event) => {
    expect(zChatEvent.parse(event)).toEqual(event);
  });

  it.each([
    ['unknown type', { type: 'transfer', to: '0xabc' }],
    ['number amount in a quote', { type: 'order_confirm', quote: { ...QUOTE, amount: 9000 } }],
    ['decimal price in a card', { type: 'recommendations', items: [{ ...REC, price: '9000.5' }] }],
    ['more than 3 recommendations', { type: 'recommendations', items: [REC, REC, REC, REC] }],
    ['unknown error code', { type: 'order_failed', code: 'OOPS', dragonLine: 'x' }],
    [
      'level 4 in a limit card',
      {
        type: 'limit_change_card',
        card: {
          cardId: 'c',
          field: 'perOrder',
          from: '1',
          to: '2',
          levelTo: 4,
          needsReauth: false,
          rows: [],
        },
      },
    ],
    ['extra field', { type: 'token', text: 'a', html: '<b>a</b>' }],
    ['order_confirm without a quote', { type: 'order_confirm' }],
  ])('rejects %s', (_name, event) => {
    expect(zChatEvent.safeParse(event).success).toBe(false);
  });

  it('keeps history turns as the events they were made of', () => {
    const h = {
      startedAt: 1,
      nextCursor: null,
      messages: [
        { id: 'u1', role: 'user', text: '점심 시켜 줘' },
        {
          id: 'd1',
          role: 'dragon',
          events: [
            { type: 'token', text: '찾아볼게용' },
            { type: 'done', messageId: 'd1' },
          ],
        },
      ],
    };
    expect(zChatHistory.parse(h)).toEqual(h);
    expect(
      zChatHistory.safeParse({ ...h, messages: [{ id: 'x', role: 'system', text: 'x' }] }).success,
    ).toBe(false);
  });

  it('takes an optional cursor and nothing else in the history query', () => {
    expect(zChatHistoryQuery.parse({})).toEqual({});
    expect(zChatHistoryQuery.parse({ cursor: 'm-1' })).toEqual({ cursor: 'm-1' });
    expect(zChatHistoryQuery.safeParse({ cursor: '' }).success).toBe(false);
    expect(zChatHistoryQuery.safeParse({ cursor: 'm', userId: 'u2' }).success).toBe(false);
  });

  it('takes a trimmed, non-empty message with a client id', () => {
    expect(zSendChatMessageBody.parse({ text: '  점심 ', clientMessageId: 'c1' }).text).toBe(
      '점심',
    );
    expect(zSendChatMessageBody.safeParse({ text: '   ', clientMessageId: 'c1' }).success).toBe(
      false,
    );
    expect(
      zSendChatMessageBody.safeParse({ text: 'a'.repeat(501), clientMessageId: 'c1' }).success,
    ).toBe(false);
    expect(
      zSendChatMessageBody.safeParse({ text: 'a', clientMessageId: 'c1', userId: 'u2' }).success,
    ).toBe(false);
  });
});

describe('order schemas (tech-spec 3.2)', () => {
  it('lists the ten order states of payment.md', () => {
    expect(ORDER_STATUSES).toEqual([
      'quoted',
      'pending_approval',
      'submitting',
      'paid',
      'preparing',
      'delivering',
      'delivered',
      'failed',
      'cancelled',
      'refunded',
    ]);
  });

  it('never lets the client send a price or amount with an order', () => {
    const body = { merchantId: 'm1', items: [{ menuId: 'menu1', qty: 1 }], clientOrderId: 'c1' };
    expect(zCreateOrderBody.parse(body)).toEqual(body);
    expect(zCreateOrderBody.safeParse({ ...body, amount: W9000 }).success).toBe(false);
    expect(
      zCreateOrderBody.safeParse({ ...body, items: [{ menuId: 'menu1', qty: 1, price: '1' }] })
        .success,
    ).toBe(false);
    expect(
      zCreateOrderBody.safeParse({ ...body, items: [{ menuId: 'menu1', qty: 0 }] }).success,
    ).toBe(false);
    expect(zCreateOrderBody.safeParse({ ...body, items: [] }).success).toBe(false);
  });

  it('returns a quote for quoted orders and none for pending approval', () => {
    expect(
      zCreateOrderResult.parse({ order: { id: 'o1', status: 'quoted' }, quote: QUOTE }).quote,
    ).toEqual(QUOTE);
    expect(
      zCreateOrderResult.parse({ order: { id: 'o1', status: 'pending_approval' } }).quote,
    ).toBeUndefined();
    expect(zOrderQuote.safeParse({ ...QUOTE, items: [] }).success).toBe(false);
  });

  it('shows an order with a dragon face from the known moods', () => {
    const view = {
      id: 'o1',
      status: 'preparing',
      store: '마루국밥',
      destination: '회사',
      items: QUOTE.items,
      amount: W9000,
      etaAt: 1_767_000_000_000,
      remainingMin: 18,
      dragonLine: '조리 중이에용',
      dragonMood: 'cooking',
    };
    expect(zOrderView.parse(view)).toEqual(view);
    expect(zOrderView.safeParse({ ...view, dragonMood: 'angry' }).success).toBe(false);
    expect(zOrderView.safeParse({ ...view, status: 'done' }).success).toBe(false);
    expect(DRAGON_MOODS).toContain('cooking');
  });
});

describe('me and sign-up schemas', () => {
  it('reads the dragon, level and per-order limit', () => {
    const me = { dragonName: '용이', dragonSpecies: 'forest', level: 1, perOrderLimit: W10000 };
    expect(zMeView.parse(me)).toEqual(me);
    expect(zMeView.safeParse({ ...me, level: 4 }).success).toBe(false);
    expect(zMeView.safeParse({ ...me, dragonSpecies: 'fire' }).success).toBe(false);
  });

  it('names a dragon with 1 to 8 letters after trimming', () => {
    expect(
      zCreateAgentBody.parse({ dragonName: ' 봄봄 ', dragonSpecies: 'water' }).dragonName,
    ).toBe('봄봄');
    expect(zCreateAgentBody.safeParse({ dragonName: '  ', dragonSpecies: 'water' }).success).toBe(
      false,
    );
    expect(
      zCreateAgentBody.safeParse({ dragonName: '가'.repeat(9), dragonSpecies: 'water' }).success,
    ).toBe(false);
  });

  it('has three setup steps and a server-chosen verify mode', () => {
    const steps = ['wallet', 'identity', 'limit'].map((key) => ({ key, status: 'waiting' }));
    expect(zAgentSetupView.parse({ status: 'PENDING', steps }).steps).toHaveLength(3);
    expect(zAgentSetupView.safeParse({ status: 'PENDING', steps: steps.slice(1) }).success).toBe(
      false,
    );
    expect(zSignupConfig.parse({ verifyMode: 'mock', trialAllowance: W10000 }).verifyMode).toBe(
      'mock',
    );
    expect(zSignupConfig.safeParse({ verifyMode: 'sms', trialAllowance: W10000 }).success).toBe(
      false,
    );
  });
});
