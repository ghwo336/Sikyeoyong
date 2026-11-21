import { describe, expect, it } from 'vitest';
import {
  exitCodeOf,
  findChainWords,
  formatTable,
  isBenignConsole,
  type Outcome,
} from './checks.ts';

describe('findChainWords', () => {
  it('finds blockchain words on a user screen', () => {
    expect(findChainWords('주인 지갑에서 토큰을 보내요')).toEqual(['지갑', '토큰']);
  });
  it('finds nothing in plain delivery talk', () => {
    expect(findChainWords('돼지국밥 9,000원 시키기. 용이 용돈이 남았어요')).toEqual([]);
  });
});

describe('isBenignConsole', () => {
  it('lets the who-am-i answer before login and the favicon pass', () => {
    const base = { type: 'error', text: 'Failed to load resource: 401' };
    expect(isBenignConsole({ ...base, url: 'http://localhost:1/api/me' })).toBe(true);
    expect(isBenignConsole({ ...base, url: 'http://localhost:1/favicon.ico' })).toBe(true);
  });
  it('flags any other failed request and any script error', () => {
    const failed = {
      type: 'error',
      text: 'Failed to load resource: 500',
      url: 'http://x/api/chat',
    };
    expect(isBenignConsole(failed)).toBe(false);
    expect(isBenignConsole({ type: 'error', text: 'TypeError: x', url: '' })).toBe(false);
  });
  it('ignores warnings and logs', () => {
    expect(isBenignConsole({ type: 'warn', text: 'deprecated', url: '' })).toBe(true);
  });
});

const o = (status: Outcome['status'], scene = '1'): Outcome => ({
  scene,
  title: 'x',
  status,
  detail: status === 'fail' ? 'why' : '',
});

describe('table and exit code', () => {
  it('prints one line per scene and a total', () => {
    const t = formatTable([o('pass', '1'), o('fail', '2'), o('skip', '5')]);
    expect(t.split('\n')).toHaveLength(4);
    expect(t).toContain('FAIL  2   x  why');
    expect(t).toContain('1 pass, 1 fail, 1 skip');
  });
  it('exits 1 on any failure, or when nothing passed; a skip alone is fine beside a pass', () => {
    expect(exitCodeOf([o('pass'), o('skip')])).toBe(0);
    expect(exitCodeOf([o('pass'), o('fail')])).toBe(1);
    expect(exitCodeOf([o('skip')])).toBe(1);
  });
});
