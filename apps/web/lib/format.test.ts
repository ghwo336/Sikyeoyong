import { okrwToAokrw } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { amountRatioText, chatStamp, minutes, routeLine, withEunNeun, withRo } from './format';

// Written by hand: 2026-11-19 03:28 UTC is 12:28 KST on the 19th.
const NOON_KST = Date.UTC(2026, 10, 19, 3, 28);

describe('format', () => {
  it('chatStamp says 오늘 for the same KST day, whatever the machine zone is', () => {
    expect(chatStamp(NOON_KST, NOON_KST + 60_000)).toBe('오늘 오후 12:28');
  });

  it('chatStamp splits days at KST midnight, not UTC midnight', () => {
    const beforeMidnightKst = Date.UTC(2026, 10, 19, 14, 59); // 23:59 KST on the 19th
    const afterMidnightKst = Date.UTC(2026, 10, 19, 15, 1); // 00:01 KST on the 20th
    expect(chatStamp(beforeMidnightKst, beforeMidnightKst)).toBe('오늘 오후 11:59');
    expect(chatStamp(beforeMidnightKst, afterMidnightKst)).toBe('오후 11:59');
  });

  it('minutes and routeLine match the design words', () => {
    expect(minutes(25)).toBe('25분');
    expect(routeLine('마루국밥 본점', '회사(역삼동)')).toBe('마루국밥 본점에서 회사(역삼동)로');
    expect(routeLine('마루국밥 본점', '회사(역삼동)', 25)).toBe(
      '마루국밥 본점에서 회사(역삼동)로, 25분쯤',
    );
  });
});

describe('amountRatioText', () => {
  it('shows the unit once, after the max', () => {
    expect(amountRatioText(okrwToAokrw(9_000n), okrwToAokrw(10_000n))).toBe('9,000 / 10,000원');
    expect(amountRatioText(0n, okrwToAokrw(60_000n))).toBe('0 / 60,000원');
  });
});

describe('withEunNeun', () => {
  it('은 after a final consonant, 는 otherwise', () => {
    expect(withEunNeun('보쌈 정식')).toBe('보쌈 정식은');
    expect(withEunNeun('돼지국밥')).toBe('돼지국밥은');
    expect(withEunNeun('피자')).toBe('피자는');
    expect(withEunNeun('보쌈 대(大)')).toBe('보쌈 대(大)는');
    expect(withEunNeun('')).toBe('는');
  });
});

describe('withRo (browser QA: "집로")', () => {
  it('으로 after a final consonant, 로 after a vowel or ㄹ', () => {
    expect(withRo('집')).toBe('집으로');
    expect(withRo('회사')).toBe('회사로');
    expect(withRo('서울')).toBe('서울로');
    expect(withRo('역삼동')).toBe('역삼동으로');
  });

  it('judges the word before a note in parentheses; not Hangul takes 로', () => {
    expect(withRo('회사(역삼동)')).toBe('회사(역삼동)로');
    expect(withRo('집 (101동)')).toBe('집 (101동)으로');
    expect(withRo('A동')).toBe('A동으로');
    expect(withRo('B')).toBe('B로');
    expect(withRo('')).toBe('로');
  });

  it('routeLine uses it', () => {
    expect(routeLine('한상보쌈', '집')).toBe('한상보쌈에서 집으로');
  });
});
