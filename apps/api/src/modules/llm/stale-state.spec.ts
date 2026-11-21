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
