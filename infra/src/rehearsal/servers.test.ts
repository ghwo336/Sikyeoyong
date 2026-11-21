import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLANKED, REPO_ROOT, apiEnv, webEnv } from './servers.ts';

function exampleKeys(): string[] {
  return readFileSync(join(REPO_ROOT, '.env.example'), 'utf8')
    .split('\n')
    .map((l) => /^([A-Z][A-Z0-9_]*)=/.exec(l)?.[1])
    .filter((k): k is string => k !== undefined);
}

describe('rehearsal environment', () => {
  it('blanks or sets every key of .env.example, so a developer .env never leaks in', () => {
    const handled = new Set([
      ...BLANKED,
      ...Object.keys(apiEnv({ api: 1, web: 2 }, '/tmp/x.db')),
      ...Object.keys(webEnv({ api: 1, web: 2 })),
    ]);
    expect(exampleKeys().filter((k) => !handled.has(k))).toEqual([]);
  });

  it('blanked keys are really empty in the api env', () => {
    const env = apiEnv({ api: 1, web: 2 }, '/tmp/x.db');
    for (const k of BLANKED) expect(env[k]).toBe('');
  });
});
