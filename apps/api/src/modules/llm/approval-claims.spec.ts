import { describe, expect, it, vi } from 'vitest';
import { ApprovalClaimScreen, stripApprovalClaims } from './approval-claims.js';
import { ScriptedProvider, type ScriptedTurn } from './harness/scripted-provider.js';
import { AgentRuntime, NOTHING_DECIDED, type RuntimeEvent, type ToolHandlers } from './runtime.js';

// Browser QA pass 5: "승인 요청은 보냈어용 ... 승인해 주셨어용" still reached the screen with no
// approval. The wait guard only hides words AFTER an order waits; these paths speak before it,
// in a later message, or when no approval was needed. The text screen drops the claims itself.

const ME = { userId: 'user-me' };

function handlers(): ToolHandlers {
  return {
    get_budget: vi.fn(() => Promise.resolve({ level: 1 })),
    get_order_history: vi.fn(() => Promise.resolve([])),
    get_context: vi.fn(() => Promise.resolve({})),
    recommend_merchants: vi.fn(() => Promise.resolve([])),
    get_menu: vi.fn(() => Promise.resolve({})),
    place_order: vi.fn(() => Promise.resolve({})),
    request_owner_approval: vi.fn(() => Promise.resolve({ status: 'NO_APPROVAL_NEEDED' })),
    propose_limit_change: vi.fn(() => Promise.resolve({})),
  };
}

async function run(
  turns: ScriptedTurn[],
  history: ConstructorParameters<typeof Array>[0][] = [],
  userText = '시켜 줘',
) {
  const provider = new ScriptedProvider(turns);
  const events: RuntimeEvent[] = [];
  const messages = await new AgentRuntime(provider, handlers()).run(
    { ctx: ME, history: history as never, userText },
    (e) => events.push(e),
  );
  const said = events.filter((e) => e.type === 'token').map((e) => e.text);
  return { provider, messages, said };
}

const tool = (name: string, input: unknown) => ({ tool: name, input });

describe('stripApprovalClaims', () => {
  it.each([
    '승인 요청은 보냈어용.',
    '주인님, 승인해 주셨어용!',
    '허락을 받았어용.',
    '승인이 완료됐어용.',
    '주인님이 허락해 주셨어용.',
    '승인 요청을 올렸어용.',
    '승인 요청을 드렸어용.',
    '허락을 구했어용.',
    '승인이 왔어용.',
    // Verify round 3: outcomes after a single 승인 (no second 승인 needed).
    '승인됐어용',
    '승인 완료!',
    '승인 처리됐어용',
    '주인님이 승인했어용',
    '승인 확인했어용',
    '승인 요청 했어용',
    '승인 요청이 갔어용',
    '승인 요청이 도착했어용',
    '승인 요청이 전달됐어용',
    '승인 요청 전송했어용',
    '승인 요청 발송했어용',
    '승인 요청 보내 놨어용',
    '승인 요청 넣었어용',
    '승인 요청 날렸어용',
    '승인 요청 보내졌어용',
    '승인 통과예용',
    '승인 OK!',
    '승인 끝!',
    '승인 요청 쏘았어용',
    '승인 요청 쐈어용',
    '승인 요청 넣어뒀어용',
    '승인 요청 넣어 뒀어용',
    '승인됨',
    '승인 오케이~',
    '승인 끝~',
    '승인 요청 보내놨어용',
    '승인 요청 넣어놨어요',
    '승인 요청 날려놨어용',
    '승인 요청 날렸어요',
    '승인 요청 보내졌어요',
    '승인 요청 보내 뒀어용',
    '승인 요청 올려뒀어용',
    '승인 요청 넣어 둠',
    '승인 요청 보내져 있어용',
    '승인 OK용!',
    '승인 ok예용',
    '승인 오케이예용',
    '승인 끝이에용',
    '승인 끝이에요!',
    '허락 OK 받았어용',
    '승인 요청 쏴 뒀어용',
    '승인 보내져 있어용 필요하면 말해요',
    '승인 보내져 있어용, 주문 넣으면 돼요',
    '승인 OK예용 확인 필요하면 말해요',
  ])('drops %j', (s) => {
    expect(stripApprovalClaims(s)).toEqual({ text: '', dropped: true });
  });

  it.each([
    '처음 가는 가게라 승인이 필요해용.',
    '허락이 있어야 시킬 수 있어용.',
    '국밥 어때용?',
    '허락이 필요해서 주인님께 요청해 볼게용.',
    '승인 요청 보내 드릴까용?',
    '허락이 필요해용.',
    '주인님께 물어볼게용.',
    '승인되면 알려드릴게용.',
    '승인 받아 올게용.',
    '승인 요청 넣어 볼게용.',
    '승인이 끝나면 알려드릴게용.',
    '승인 요청 보낼게용.',
    '허락해 주실래용?',
    '승인이 필요해용.',
    '승인 완료되면 바로 시킬게용.',
    '허락받으면 시킬게용.',
    '승인 요청이 도착하면 알려드릴게용.',
    '승인 요청 전달할게용.',
    '승인 요청 넣어 볼게용.',
    '승인되면 오케이 하고 시킬게용.',
    '승인 요청 보내졌는지 볼게용.',
    '승인 요청 넣었는지 확인해 볼게용.',
    '승인 요청 보내 놓을까용?',
    '승인 요청 날려 볼게용.',
    '승인 요청 보내 드릴게용.',
    '승인 확인 누르면 보내져용.',
    '승인 OK 누르면 주문돼용.',
    '승인 OK?',
    '승인 끝이에용?',
    '승인 끝나는 대로 알려드릴게용.',
    '승인이 필요하면 OK 눌러 주세용.',
    '허락 OK 해 주세용.',
    '승인이 보내져 있으면 알려 줄게요.',
    '승인 보내져 있어야 해요.',
    '승인 보내져 있나 볼게용.',
    '승인 OK 누르면 끝이에요.',
    '승인 눌러주시면 끝이에용.',
    '승인 필요한 주문이에용 OK.',
  ])('keeps %j', (s) => {
    expect(stripApprovalClaims(s)).toEqual({ text: s, dropped: false });
  });

  it('drops only the claiming sentence', () => {
    expect(stripApprovalClaims('좋아용. 승인해 주셨어용! 시킬게용.').text).toBe(
      '좋아용. 시킬게용.',
    );
  });
});

describe('ApprovalClaimScreen', () => {
  it('ends a sentence at a line break while streaming', () => {
    const screen = new ApprovalClaimScreen();
    expect(screen.push('좋아용\n승인 요청은 보냈어용\n시킬게용')).toBe('좋아용\n');
    expect(screen.dropped).toBe(true);
    expect(screen.flush()).toBe('시킬게용');
  });
});

describe('the dragon cannot claim an approval the server has not recorded (QA 5)', () => {
  it('drops a claim spoken in the same turn as a tool call, before any wait', async () => {
    const { said } = await run([
      {
        blocks: [
          { text: '승인 요청은 보냈어용. 주인님이 승인해 주셨어용! ' },
          { text: '바삭치킨이에용.' },
          tool('get_budget', {}),
        ],
      },
      { blocks: [{ text: '끝이에용.' }] },
    ]);
    expect(said.map((s) => s.trim())).toEqual(['바삭치킨이에용.', '끝이에용.']);
  });

  it('drops a claim in a message with no tool at all (a later message)', async () => {
    const { said } = await run([{ blocks: [{ text: '승인해 주셨어용. 바로 시킬게용.' }] }]);
    expect(said).toEqual(['바로 시킬게용.']);
  });

  it('judges a claim split across stream pieces as one sentence', async () => {
    const { said } = await run([
      { blocks: [{ text: '승인 요청은 ' }, { text: '보냈어용. 좋아용.' }] },
    ]);
    expect(said.join('')).toBe('좋아용.');
  });

  it('says what is true when the whole answer was a claim and nothing else showed', async () => {
    const { said } = await run([{ blocks: [{ text: '승인 요청은 보냈어용.' }] }]);
    expect(said).toEqual([NOTHING_DECIDED]);
  });

  it('keeps a reason that is not an outcome', async () => {
    const { said } = await run([{ blocks: [{ text: '처음 가는 가게라 승인이 필요해용.' }] }]);
    expect(said).toEqual(['처음 가는 가게라 승인이 필요해용.']);
  });

  it('strips claims from the stored turn and from history the model would repeat', async () => {
    const { provider, messages } = await run(
      [{ blocks: [{ text: '승인해 주셨어용. 알겠어용.' }] }],
      [
        { role: 'user', content: '시켜 줘' },
        { role: 'assistant', content: [{ type: 'text', text: '승인 요청은 보냈어용.' }] },
      ],
      '그래서?',
    );
    const first = provider.requests[0];
    const dump = JSON.stringify([...(first?.messages ?? []), ...messages]);
    expect(dump).not.toContain('보냈어용');
    expect(dump).not.toContain('주셨어용');
    expect(dump).toContain('알겠어용.');
  });
});
