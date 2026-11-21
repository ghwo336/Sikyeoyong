import { describe, expect, it } from 'vitest';
import {
  REPLY_JUDGE_MAX_OUTPUT_TOKENS,
  REPLY_JUDGE_TIMEOUT_MS,
  REPLY_MAX_CHARS,
  REPLY_MAX_OUTPUT_TOKENS,
  SCOPE_LINE,
} from './reply-guard.js';

describe('reply guard config (D-35)', () => {
  it('keeps the reply short and the output ceiling bounded', () => {
    expect(REPLY_MAX_CHARS).toBeGreaterThan(0);
    expect(REPLY_MAX_CHARS).toBeLessThanOrEqual(300);
    expect(REPLY_MAX_OUTPUT_TOKENS).toBeLessThanOrEqual(4096);
    expect(REPLY_MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(1024);
    expect(REPLY_JUDGE_MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(256);
    expect(REPLY_JUDGE_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });
  it('the scope line is short, in the dragon tone and has no dash', () => {
    expect(SCOPE_LINE.length).toBeLessThanOrEqual(REPLY_MAX_CHARS);
    expect(SCOPE_LINE).toMatch(/용[.!?]$/);
    expect(SCOPE_LINE).not.toContain(String.fromCharCode(0x2014));
    expect(SCOPE_LINE).not.toContain(String.fromCharCode(0x2013));
  });
});
