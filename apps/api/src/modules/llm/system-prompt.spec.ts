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
    expect(SYSTEM_PROMPT).toContain('"적용돼용"');
  });

  it('says weather, time and open stores only from tool results, and recommends with the tool', () => {
    // Real use: "비 오니까 따끈한 국물 어때용?" on a dry day, copied from the old tone example.
    expect(SYSTEM_PROMPT).not.toContain('비 오니까');
    expect(SYSTEM_PROMPT).toContain('이번 도구 결과');
    expect(SYSTEM_PROMPT).toContain('도구 결과에 비가 없으면 비 이야기를 하지 않는다');
    expect(SYSTEM_PROMPT).toContain('먼저 recommend_merchants를 부른다');
  });

  it('keeps the money rules and has no dashes or dates (stable cache prefix, CLAUDE.md 1)', () => {
    expect(SYSTEM_PROMPT).toContain('결제는 사용자가 카드 버튼을 누를 때 서버가 한다');
    // QA 2026-11-20: after APPROVAL_REQUIRED the dragon said it had approved and made the card.
    expect(SYSTEM_PROMPT).toContain('도구 결과에 없는 일은 했다고 말하지 않는다');
    expect(SYSTEM_PROMPT).toContain('APPROVAL_REQUIRED면 확인 카드는 만들어지지 않았고');
    expect(SYSTEM_PROMPT).toContain('허락에 대한 말은 서버가 하니');
    // Browser QA 2: an empty list was blamed on the rain.
    expect(SYSTEM_PROMPT).toContain('empty.say에 적힌 까닭');
    for (const code of [0x2013, 0x2014]) {
      expect(SYSTEM_PROMPT).not.toContain(String.fromCharCode(code));
    }
    expect(SYSTEM_PROMPT).not.toMatch(/20\d\d-\d\d-\d\d/);
  });
});
