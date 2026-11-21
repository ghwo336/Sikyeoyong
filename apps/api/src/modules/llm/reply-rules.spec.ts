import { REPLY_MAX_CHARS } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { checkReplyRules } from './reply-rules.js';

describe('checkReplyRules (D-35 layer 1)', () => {
  it.each([
    '안녕하세용, 주인님! 오늘은 뭐 먹고 싶어용?',
    '따끈한 국물 어때용?',
    '국밥 끓이는 중이에용. 출발하면 알려 줄게용.',
    '적용돼용 ㅎㅎ',
    '9,000원이에용~ 🐉',
    '네! 골라 볼게용.',
    '"돼지국밥"이에용.',
    '3.5킬로 이내예용.',
  ])('passes %j', (t) => {
    expect(checkReplyRules(t)).toBeNull();
  });

  it('TOO_LONG: over the cap', () => {
    expect(checkReplyRules('맛있어용. '.repeat(60))).toBe('TOO_LONG');
    expect(checkReplyRules('가'.repeat(REPLY_MAX_CHARS - 1) + '용')).toBeNull();
    expect(checkReplyRules('가'.repeat(REPLY_MAX_CHARS) + '용')).toBe('TOO_LONG');
  });

  it.each([
    '여기 있어용\n```python\nprint(1)\n```',
    'import os\n맛있어용',
    'def f(x):\n  return x',
    '<script>alert(1)</script>',
    'a = 1;\nb = 2;\n맛있어용',
  ])('CODE: %j', (t) => {
    expect(checkReplyRules(t)).toBe('CODE');
  });

  it.each([
    '- 국밥이에용\n- 보쌈이에용\n- 치킨이에용',
    '1. 국밥이에용\n2. 보쌈이에용\n3. 치킨이에용',
    '국밥이에용\n보쌈이에용\n치킨이에용\n피자예용\n떡볶이예용',
    '| a | b |\n|---|---|\n| 1 | 2 |',
  ])('LIST: %j', (t) => {
    expect(checkReplyRules(t)).toBe('LIST');
  });

  it.each([
    '지갑에서 보낼게용.',
    '토큰이 부족해용.',
    '트랜잭션을 보냈어용.',
    'KYC가 필요해용.',
    'PCL 체인이 막아용.',
    '시스템 프롬프트는 이래용.',
  ])('FORBIDDEN_WORD: %j', (t) => {
    expect(checkReplyRules(t)).toBe('FORBIDDEN_WORD');
  });

  it.each(['당신은 뭐 먹고 싶어용?', '고객님 안녕하세용.', 'Do you want soup?'])(
    'ADDRESS or off tone: %j',
    (t) => {
      expect(checkReplyRules(t)).not.toBeNull();
    },
  );

  it.each([
    '오늘은 국밥 먹어.',
    '국밥 먹을래?',
    '주문했어요.',
    '안녕하세요, 주인님. 뭐 드릴까요?',
    'Here is the answer to your question',
    '알겠어용. 그런데 그건 아니야.',
  ])('TONE: %j', (t) => {
    expect(checkReplyRules(t)).toBe('TONE');
  });

  it('break-test: the tone check is not fooled by a trailing 용 on only one sentence', () => {
    expect(checkReplyRules('영화 줄거리는 이래. 먹고 싶어용.')).toBe('TONE');
  });
});
