import { AppError } from '@sikyeoyong/shared';
import { describe, expect, it } from 'vitest';
import { dragonLineOf } from './error-line';

describe('dragonLineOf (QA 5)', () => {
  it("uses the server's own line when it sent one", () => {
    const err = new AppError('CHAIN_MERCHANT_INACTIVE', {
      status: 422,
      dragonLine: '이 가게는 지금 쉬고 있어용',
    });
    expect(dragonLineOf(err)).toBe('이 가게는 지금 쉬고 있어용');
  });

  it('falls back to the shared table line for the code', () => {
    expect(dragonLineOf(new AppError('CHAIN_MERCHANT_INACTIVE', { status: 422 }))).toBe(
      '이 가게는 등록이 안 돼 있어용',
    );
    expect(dragonLineOf(new AppError('SERVER_FROZEN'))).toContain('쉬고 있을게용');
  });

  it('ignores an empty server line', () => {
    expect(dragonLineOf(new AppError('NOT_FOUND', { dragonLine: '  ' }))).toBe(
      '어디 있는지 못 찾겠어용',
    );
  });

  it('uses the plain message when the line needs values the screen does not have', () => {
    // CHAIN_AGENT_LIMIT's line holds {max}: never a raw placeholder on screen.
    const line = dragonLineOf(new AppError('CHAIN_AGENT_LIMIT'));
    expect(line).not.toMatch(/[{}]/);
    expect(line).toBe('건당 한도를 넘었어요');
  });

  it('says the generic line for a dropped connection', () => {
    expect(dragonLineOf(new TypeError('fetch failed'))).toBe('앗, 뭔가 꼬였어용');
  });
});
