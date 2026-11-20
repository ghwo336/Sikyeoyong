import 'reflect-metadata';
import type { Server } from 'node:http';
import { Test } from '@nestjs/testing';
import { type ChatEvent, zChatEvent } from '@sikyeoyong/shared';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureApp } from '../../app.setup.js';
import { APP_CONFIG } from '../../config/config.module.js';
import { loadConfig } from '../../config/env.js';
import { type DbHandle, openDb } from '../../db/client.js';
import { DB } from '../../db/db.module.js';
import { runMigrations } from '../../db/migrate.js';
import { allowedMerchants, approvals, orders } from '../../db/schema/index.js';
import { insertMenu, insertMerchant, insertUser } from '../../test/fixtures.js';
import { AuthService } from '../auth/auth.service.js';
import { CHAIN_READER } from '../chain/chain.service.js';
import { ScriptedProvider } from './harness/scripted-provider.js';
import { LLM_PROVIDER } from './llm-provider.js';
import { LlmModule } from './llm.module.js';

// Amounts by hand: 9,000원 = 9000 * 10^18 aokrw. Default policy: level 1, 10,000 per order.
const W9000 = '9000000000000000000000';

const open: { close: () => Promise<void> }[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const o of open.splice(0)) await o.close();
});

const placeTurns = (qty: number, note?: string) =>
  new ScriptedProvider([
    {
      blocks: [
        {
          tool: 'place_order',
          input: {
            merchantId: 'm-gukbap',
            items: [{ menuId: 'x-dwaeji', qty }],
            ...(note === undefined ? {} : { note }),
          },
        },
      ],
    },
    { blocks: [{ text: '카드 확인해 주세용.' }] },
  ]);

async function setup(provider: ScriptedProvider, existing?: DbHandle) {
  const fresh = existing === undefined;
  const h: DbHandle = existing ?? openDb(':memory:');
  if (fresh) {
    runMigrations(h.db);
    insertUser(h.db, 'u1', { dong: '역삼동' });
    insertUser(h.db, 'u2');
    insertMerchant(h.db, 'm-gukbap', { name: '마루국밥 본점' });
    insertMenu(h.db, 'x-dwaeji', 'm-gukbap', 9_000n, { name: '돼지국밥' });
    h.db
      .insert(allowedMerchants)
      .values({ userId: 'u1', merchantId: 'm-gukbap', approvedAt: 1 })
      .run();
  }
  const chain = { used: 0n };
  const moduleRef = await Test.createTestingModule({ imports: [LlmModule] })
    .useMocker((t) => (t === DB ? h : t === APP_CONFIG ? loadConfig({}) : undefined))
    .overrideProvider(LLM_PROVIDER)
    .useValue(provider)
    .overrideProvider(CHAIN_READER)
    .useValue({
      periodicVolume: () => Promise.resolve({ usedAokrw: chain.used, resetAtSec: null }),
    })
    .compile();
  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  open.push({
    close: async () => {
      await app.close();
      if (fresh) h.close();
    },
  });
  const auth = moduleRef.get(AuthService);
  const post = (who: 'u1' | 'u2', text: string, clientMessageId: string) =>
    request(app.getHttpServer() as Server)
      .post('/api/chat/messages')
      .set('Cookie', `sid=${auth.issue(who, 'web')}`)
      .set('X-Requested-With', 'fetch')
      .send({ text, clientMessageId });
  const setChainUsed = (v: bigint) => {
    chain.used = v;
  };
  return { h, post, setChainUsed };
}

function events(text: string): ChatEvent[] {
  return text
    .split('\n\n')
    .filter((f) => f.startsWith('data: '))
    .map((f) => zChatEvent.parse(JSON.parse(f.slice('data: '.length))));
}

const toolResult = (provider: ScriptedProvider) => {
  const r = provider.resultsAfter(1)[0];
  return typeof r?.content === 'string' ? r.content : JSON.stringify(r?.content);
};

describe('place_order in the chat stream: a confirm card, never a payment', () => {
  it('shows the server quote as an order_confirm card; the model hears display words only', async () => {
    const provider = placeTurns(1, '깍두기 많이');
    const { h, post } = await setup(provider);
    const list = events((await post('u1', '2번으로 시켜 줘', 'c1')).text);
    const cardEvent = list.find((e) => e.type === 'order_confirm');
    const order = h.db.select().from(orders).get();
    expect(cardEvent).toEqual({
      type: 'order_confirm',
      quote: {
        orderId: order?.id,
        store: '마루국밥 본점',
        destination: '역삼동',
        etaMin: 3,
        items: [{ name: '돼지국밥', quantity: 1, price: W9000 }],
        request: '깍두기 많이',
        amount: W9000,
        dragonLine: '돼지국밥 시킬게용.\n이대로 괜찮아용?',
        perOrderLimit: '10000000000000000000000',
        periodUsedAfter: W9000,
        periodCap: '500000000000000000000000',
      },
    });
    expect(order).toMatchObject({
      userId: 'u1',
      status: 'quoted',
      clientOrderId: null,
      note: '깍두기 많이',
      // Nothing started paying: no attempt, no submit marker, no transaction.
      attempt: 0,
      submitStartedAt: null,
      txHash: null,
    });
    const forModel = toolResult(provider);
    expect(forModel).toContain('CONFIRM_CARD_SHOWN');
    expect(forModel).toContain('9,000원');
    expect(forModel).toContain('"paid":false');
    expect(forModel).not.toContain(W9000);
    expect(forModel).not.toContain(order?.id ?? 'no id');
  });

  it('an order that needs the owner gives the model APPROVAL_REQUIRED and the screen no card', async () => {
    const provider = placeTurns(2); // 18,000 over level 1
    const { h, post } = await setup(provider);
    const list = events((await post('u1', '두 그릇 시켜 줘', 'c1')).text);
    expect(list.some((e) => e.type === 'order_confirm')).toBe(false);
    expect(toolResult(provider)).toContain('APPROVAL_REQUIRED');
    expect(toolResult(provider)).toContain('OVER_LEVEL_LIMIT');
    expect(h.db.select().from(orders).get()?.status).toBe('pending_approval');
    expect(h.db.select().from(approvals).get()?.reason).toBe('OVER_LEVEL_LIMIT');
  });

  it('orders for the session user only (the input has no user)', async () => {
    const provider = placeTurns(1);
    const { h, post } = await setup(provider);
    await post('u2', '시켜 줘', 'c1');
    const order = h.db.select().from(orders).get();
    expect(order?.userId).toBe('u2');
    expect(order?.status).toBe('pending_approval'); // m-gukbap is new for u2
    expect(h.db.select().from(approvals).get()?.reason).toBe('NEW_MERCHANT');
  });

  it('a refused quote (30-day cap) gives the model the error, the screen no card, and makes no order', async () => {
    const provider = placeTurns(1);
    const { h, post, setChainUsed } = await setup(provider);
    setChainUsed(BigInt('495000000000000000000000')); // 495,000 + 9,000 > 500,000
    const list = events((await post('u1', '시켜 줘', 'c1')).text);
    expect(list.some((e) => e.type === 'order_confirm')).toBe(false);
    expect(provider.resultsAfter(1)[0]?.is_error).toBe(true);
    expect(toolResult(provider)).toContain('CHAIN_PERIODIC_LIMIT');
    expect(h.db.select().from(orders).all()).toHaveLength(0);
  });
});

const askTurns = (input: Record<string, unknown>) =>
  new ScriptedProvider([
    { blocks: [{ tool: 'request_owner_approval', input }] },
    { blocks: [{ text: '주인님께 여쭤볼게용.' }] },
  ]);

const payloadOf = (h: DbHandle) =>
  JSON.parse(h.db.select().from(approvals).get()?.payloadJson ?? '{}') as Record<string, string>;

describe('request_owner_approval: asks the owner, never approves or pays', () => {
  it("puts the message on the live approval of the same store and items; the reason is the server's", async () => {
    const first = placeTurns(2); // 18,000: over level 1
    const { h, post } = await setup(first);
    await post('u1', '두 그릇 시켜 줘', 'c1');
    expect(h.db.select().from(approvals).all()).toHaveLength(1);
    // A new app for the next message: same DB, a provider that asks the owner.
    const ask = askTurns({
      reason: 'NEW_MERCHANT', // the model's guess; the server's reason wins
      merchantId: 'm-gukbap',
      items: [{ menuId: 'x-dwaeji', qty: 2 }],
      message: '두 그릇 먹고 싶대용',
    });
    const second = await setup(ask, h);
    await second.post('u1', '허락받아 줘', 'c2');
    const out = toolResult(ask);
    expect(out).toContain('APPROVAL_REQUESTED');
    expect(out).toContain('OVER_LEVEL_LIMIT');
    expect(out).not.toContain('NEW_MERCHANT');
    expect(h.db.select().from(orders).all()).toHaveLength(1);
    expect(h.db.select().from(approvals).all()).toHaveLength(1);
    expect(payloadOf(h).message).toBe('두 그릇 먹고 싶대용');
    expect(h.db.select().from(approvals).get()?.status).toBe('pending');
  });

  it('a waiting order at the same store with other items is not the one asked about', async () => {
    const first = placeTurns(2);
    const { h, post } = await setup(first);
    await post('u1', '두 그릇 시켜 줘', 'c1');
    const ask = askTurns({
      reason: 'OVER_LEVEL_LIMIT',
      merchantId: 'm-gukbap',
      items: [{ menuId: 'x-dwaeji', qty: 1 }],
      message: '한 그릇만',
    });
    const second = await setup(ask, h);
    await second.post('u1', '한 그릇 허락받아 줘', 'c2');
    expect(payloadOf(h).message).toBeUndefined();
    expect(
      h.db
        .select()
        .from(orders)
        .all()
        .map((o) => o.status)
        .sort(),
    ).toEqual(['pending_approval', 'quoted']);
  });

  it('with nothing waiting, it makes the order the place_order way (pending with the message)', async () => {
    const ask = askTurns({
      reason: 'OVER_LEVEL_LIMIT',
      merchantId: 'm-gukbap',
      items: [{ menuId: 'x-dwaeji', qty: 2 }],
      message: '부탁해용',
    });
    const { h, post } = await setup(ask);
    await post('u1', '허락받아 줘', 'c1');
    expect(h.db.select().from(orders).get()?.status).toBe('pending_approval');
    expect(payloadOf(h).message).toBe('부탁해용');
    expect(toolResult(ask)).toContain('APPROVAL_REQUESTED');
  });

  it('if the server needs no owner after all, the confirm card comes up instead', async () => {
    const ask = askTurns({
      reason: 'OVER_LEVEL_LIMIT',
      merchantId: 'm-gukbap',
      items: [{ menuId: 'x-dwaeji', qty: 1 }],
    });
    const { h, post } = await setup(ask);
    const list = events((await post('u1', '허락받아 줘', 'c1')).text);
    expect(list.some((e) => e.type === 'order_confirm')).toBe(true);
    expect(h.db.select().from(orders).get()?.status).toBe('quoted');
    expect(h.db.select().from(approvals).all()).toHaveLength(0);
    expect(toolResult(ask)).toContain('CONFIRM_CARD_SHOWN');
  });

  it("with no store and nothing waiting it is NOT_FOUND; another user's approval is not touched", async () => {
    const first = placeTurns(2);
    const { h, post } = await setup(first);
    await post('u1', '두 그릇 시켜 줘', 'c1');
    const ask = askTurns({ reason: 'OVER_LEVEL_LIMIT', message: '남의 것' });
    const second = await setup(ask, h);
    await second.post('u2', '허락받아 줘', 'c2');
    expect(ask.resultsAfter(1)[0]?.is_error).toBe(true);
    expect(toolResult(ask)).toContain('NOT_FOUND');
    expect(payloadOf(h).message).toBeUndefined();
  });

  it('an expired approval does not get the message', async () => {
    const first = placeTurns(2);
    const { h, post } = await setup(first);
    await post('u1', '두 그릇 시켜 줘', 'c1');
    h.db.update(approvals).set({ expiresAt: 1 }).run();
    const ask = askTurns({ reason: 'OVER_LEVEL_LIMIT', message: '늦었어용' });
    const second = await setup(ask, h);
    await second.post('u1', '허락받아 줘', 'c2');
    expect(toolResult(ask)).toContain('NOT_FOUND');
    expect(payloadOf(h).message).toBeUndefined();
  });
});
