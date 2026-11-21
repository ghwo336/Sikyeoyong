/**
 * Pure checks of the rehearsal (no browser): blockchain words on a user screen (CLAUDE.md 12,
 * D-17), console noise that is expected, and the pass/fail table.
 */

/** Words a user screen must not show outside the 자세히 보기 part (CLAUDE.md 12). */
export const CHAIN_WORDS = ['지갑', '토큰', '트랜잭션', 'KYC', 'PCL', '블록체인', '가스'] as const;

/** The chain words found in a screen's text, each once, in the order of CHAIN_WORDS. */
export function findChainWords(text: string): string[] {
  return CHAIN_WORDS.filter((w) => text.includes(w));
}

export interface ConsoleNote {
  readonly type: string;
  readonly text: string;
  readonly url: string;
}

/**
 * The browser logs "Failed to load resource" for any 4xx answer. Asking who I am before the
 * login (/api/me 401 or 404) and the missing favicon are expected, so they are not errors.
 */
export function isBenignConsole(note: ConsoleNote): boolean {
  if (note.type !== 'error') return true;
  if (!note.text.startsWith('Failed to load resource')) return false;
  return /\/api\/me$|favicon|\.ico$|manifest/.test(note.url);
}

export interface Outcome {
  readonly scene: string;
  readonly title: string;
  readonly status: 'pass' | 'fail' | 'skip';
  readonly detail: string;
}

const MARK = { pass: 'PASS', fail: 'FAIL', skip: 'SKIP' } as const;

/** One line per scene: mark, scene, title, detail (why it failed or was skipped). */
export function formatTable(outcomes: readonly Outcome[]): string {
  const rows = outcomes.map((o) => {
    const detail = o.detail === '' ? '' : `  ${o.detail}`;
    return `${MARK[o.status]}  ${o.scene.padEnd(3)} ${o.title}${detail}`;
  });
  const failed = outcomes.filter((o) => o.status === 'fail').length;
  const passed = outcomes.filter((o) => o.status === 'pass').length;
  const skipped = outcomes.filter((o) => o.status === 'skip').length;
  return [...rows, `${String(passed)} pass, ${String(failed)} fail, ${String(skipped)} skip`].join(
    '\n',
  );
}

/** 0 only when no scene failed (a skipped scene is not a failure) and at least one passed. */
export function exitCodeOf(outcomes: readonly Outcome[]): 0 | 1 {
  const failed = outcomes.some((o) => o.status === 'fail');
  const passed = outcomes.some((o) => o.status === 'pass');
  return !failed && passed ? 0 : 1;
}
