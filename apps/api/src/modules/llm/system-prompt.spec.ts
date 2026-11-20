import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT } from './system-prompt.js';

describe('SYSTEM_PROMPT (agent-runtime.md)', () => {
  it('keeps the dragon to delivery and turns away other requests in one line', () => {
    expect(SYSTEM_PROMPT).toContain('배달 음식, 메뉴 추천');
    expect(SYSTEM_PROMPT).toContain('저는 배달만 도와드릴 수 있어용');
  });

  it('fixes the voice: polite endings with 용, never 반말, one or two sentences', () => {
    expect(SYSTEM_PROMPT).toContain('해요체');
    expect(SYSTEM_PROMPT).toContain('반말은 한 번도 쓰지 않는다');
    expect(SYSTEM_PROMPT).toContain('한 번에 한두 문장');
  });

  it('keeps the money rules and has no dashes or dates (stable cache prefix, CLAUDE.md 1)', () => {
    expect(SYSTEM_PROMPT).toContain('결제는 사용자가 카드 버튼을 누를 때 서버가 한다');
    // QA 2026-11-20: after APPROVAL_REQUIRED the dragon said it had approved and made the card.
    expect(SYSTEM_PROMPT).toContain('도구 결과에 없는 일은 했다고 말하지 않는다');
    expect(SYSTEM_PROMPT).toContain('APPROVAL_REQUIRED면 확인 카드는 만들어지지 않았다');
    for (const code of [0x2013, 0x2014]) {
      expect(SYSTEM_PROMPT).not.toContain(String.fromCharCode(code));
    }
    expect(SYSTEM_PROMPT).not.toMatch(/20\d\d-\d\d-\d\d/);
  });
});
