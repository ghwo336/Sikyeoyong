import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { ScriptedProvider } from './harness/scripted-provider.js';
import { AgentRuntime, type ToolHandlers } from './runtime.js';
import { stripStaleState } from './stale-state.js';

describe('stripStaleState', () => {
  it('drops sentences about approval, quote or order state and keeps the rest', () => {
    expect(
      stripStaleState('승인 요청은 진행 중이라 지금은 기다리고 있는 중이용. 국물 어때용?'),
    ).toBe('국물 어때용?');
    expect(stripStaleState('주문 접수됐어용! 곧 도착해용. 안녕하세용')).toBe('안녕하세용');
    expect(stripStaleState('견적 만들었어용.')).toBe('');
  });

  it('keeps proposals, offers and quotes the user may answer with 응', () => {
    for (const s of [
      '돼지국밥으로 주문할까용?',
      '돼지국밥 9,000원이에용. 이걸로 주문해 볼까용?',
      '견적 확인해 주세용.',
      '주문은 카드 버튼을 누르면 돼용. 마루국밥 돼지국밥이에용.',
      '출발하면 알려 줄게용.',
      '결제 전에 한 번 더 볼까용?',
      // These match the status patterns, so only the offer rule keeps them.
      '주문 접수할까용?',
      '배달 중이면 알려드릴까용?',
      '결제됐는지 확인해 볼까용?',
      '승인 기다리는 동안 다른 메뉴 볼까용?',
    ]) {
      expect(stripStaleState(s), s).toBe(s);
    }
  });

  it('removes only the status claim from a mixed turn', () => {
    expect(
      stripStaleState('돼지국밥 어때용? 승인 대기 중이에용. 주문 넣었어용. 배달 중이에용.'),
    ).toBe('돼지국밥 어때용? ');
    expect(stripStaleState('도착했어용.')).toBe('');
    expect(stripStaleState('결제됐어용.')).toBe('');
  });

  it('keeps plain food talk', () => {
    expect(stripStaleState('따끈한 국물 어때용?')).toBe('따끈한 국물 어때용?');
    expect(stripStaleState('')).toBe('');
  });
});

describe('earlier turns reach the model without stale state', () => {
  it('an old approval line is not in the messages the model gets this turn', async () => {
    const seen: Anthropic.MessageParam[][] = [];
    const provider = new ScriptedProvider([{ blocks: [{ text: '네용' }] }]);
    const original = provider.turn.bind(provider);
    provider.turn = (req, onText, signal) => {
      seen.push(structuredClone(req.messages));
      return original(req, onText, signal);
    };
    const handlers = { get_order_history: vi.fn() } as unknown as ToolHandlers;
    await new AgentRuntime(provider, handlers).run(
      {
        ctx: { userId: 'u' },
        history: [
          { role: 'user', content: '국밥' },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: '승인 요청은 진행 중이라 기다리고 있어용. 국밥 좋아용.' },
            ],
          },
        ],
        userText: '안녕',
      },
      () => undefined,
    );
    expect(JSON.stringify(seen[0])).not.toContain('승인 요청은 진행 중');
    expect(JSON.stringify(seen[0])).toContain('국밥 좋아용');
  });

  it('the same holds for the plain-string turns the chat module sends', async () => {
    const seen: Anthropic.MessageParam[][] = [];
    const provider = new ScriptedProvider([{ blocks: [{ text: '네용' }] }]);
    const original = provider.turn.bind(provider);
    provider.turn = (req, onText, signal) => {
      seen.push(structuredClone(req.messages));
      return original(req, onText, signal);
    };
    const handlers = { get_order_history: vi.fn() } as unknown as ToolHandlers;
    await new AgentRuntime(provider, handlers).run(
      {
        ctx: { userId: 'u' },
        history: [
          { role: 'user', content: '국밥' },
          { role: 'assistant', content: '승인 요청은 진행 중이라 기다리고 있어용. 국밥 좋아용.' },
        ],
        userText: '안녕',
      },
      () => undefined,
    );
    expect(seen[0]?.[1]).toEqual({ role: 'assistant', content: '국밥 좋아용.' });
  });
});
