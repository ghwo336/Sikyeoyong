import {
  zBudgetView,
  zChatEvent,
  zChatHistory,
  zCreateOrderResult,
  zMeView,
  zOrderView,
  zSignupConfig,
} from '@sikyeoyong/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi, resetMockSession } from './client';

// The mock must speak exactly what the server will: the shared zod schemas (strict, aokrw strings).
// A mock that drifts from them would let screens pass here and break against the real API.
describe('mockApi answers match the shared API schemas', () => {
  beforeEach(() => {
    resetMockSession('hatched');
  });

  it('me, budget, sign-up config and history', async () => {
    expect(zMeView.safeParse(await mockApi.getMe()).success).toBe(true);
    expect(zBudgetView.safeParse(await mockApi.getBudget()).success).toBe(true);
    expect(zSignupConfig.safeParse(await mockApi.getSignupConfig()).success).toBe(true);
    const history = zChatHistory.safeParse(await mockApi.getChatHistory());
    expect(history.error?.issues ?? []).toEqual([]);
  });

  it.each(['점심 시켜 줘', '다른 거', '제일 싼 걸로'])('chat events for %j', async (text) => {
    const events = await mockApi.sendChatMessage({ text, clientMessageId: `c-${text}` });
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      const r = zChatEvent.safeParse(e);
      expect(r.error?.issues ?? [], JSON.stringify(e)).toEqual([]);
    }
  });

  it('order quote, approval wait and the confirmed order', async () => {
    const quoted = await mockApi.createOrder({
      merchantId: 'maru-gukbap',
      items: [{ menuId: 'pork-gukbap', qty: 1 }],
      clientOrderId: 'schema-1',
    });
    expect(zCreateOrderResult.safeParse(quoted).error?.issues ?? []).toEqual([]);
    const waiting = await mockApi.createOrder({
      merchantId: 'hansang-bossam',
      items: [{ menuId: 'bossam-set', qty: 1 }],
      clientOrderId: 'schema-2',
    });
    expect(zCreateOrderResult.safeParse(waiting).error?.issues ?? []).toEqual([]);
    const { order } = await mockApi.confirmOrder(quoted.order.id);
    expect(zOrderView.safeParse(order).error?.issues ?? []).toEqual([]);
  });
});
