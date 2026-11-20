import { okrwToAokrw } from '@sikyeoyong/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockApi, resetMockSession } from './client';

const won = (n: bigint) => okrwToAokrw(n).toString();
const say = async (text: string) =>
  (await mockApi.sendChatMessage({ text, clientMessageId: text })).filter((e) => e.type !== 'done');

describe('the mock dragon (a few kinds of words only)', () => {
  beforeEach(() => {
    resetMockSession('hatched');
  });

  it('words it does not know get a line and no cards, so the cards never repeat', async () => {
    const events = await say('그럼 다른 얘기 해 보자');
    expect(events).toEqual([
      { type: 'token', text: '음, 그건 잘 모르겠어용. 뭐 먹고 싶은지 말해 주세용.' },
    ]);
  });

  it('budget words get this month: spent and left (210,000 of 300,000)', async () => {
    expect(await say('이번 달 얼마 남았어?')).toEqual([
      { type: 'token', text: '이번 달 210,000원 썼고 90,000원 남았어용.' },
    ]);
  });

  it('over the budget, it says by how much (210,000 of 200,000)', async () => {
    await mockApi.setMonthlyBudget(won(200_000n));
    expect(await say('그럼 다 쓴 거 아님?')).toEqual([
      {
        type: 'token',
        text: '이번 달 예산 200,000원을 벌써 10,000원 넘었어용. 더 시키면 주인님 허락을 받을게용.',
      },
    ]);
  });

  it('food words get the recommendations; a menu name its confirm card', async () => {
    const food = await say('저녁 시켜 줘');
    expect(food.map((e) => e.type)).toEqual(['token', 'recommendations']);
    const pick = await say('돼지국밥으로');
    expect(pick.map((e) => e.type)).toEqual(['order_confirm']);
  });
});
