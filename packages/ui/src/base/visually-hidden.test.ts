import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// A visually hidden span with position: absolute and no top/left sits at its static
// position. Inside a long chat that can be far below the screen and make the page scroll
// (browser QA, limit change card). Every .srOnly rule must pin itself to its box.
const root = resolve(__dirname, '..');

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith('.module.css') ? [path] : [];
  });
}

const srOnlyRules = cssFiles(root).flatMap((file) => {
  const body = /(^|\n)\.srOnly\s*\{([^}]*)\}/.exec(readFileSync(file, 'utf8'))?.[2];
  return body === undefined ? [] : [{ file, body }];
});

describe('visually hidden text (.srOnly)', () => {
  it('exists somewhere, so this check is not empty', () => {
    expect(srOnlyRules.length).toBeGreaterThan(0);
  });

  it.each(srOnlyRules.map((r) => [r.file.slice(root.length + 1), r.body]))(
    '%s is clipped and pinned to the top left of its box',
    (_file, body) => {
      expect(body).toMatch(/position:\s*absolute/);
      expect(body).toMatch(/top:\s*0/);
      expect(body).toMatch(/left:\s*0/);
      expect(body).toMatch(/width:\s*1px/);
      expect(body).toMatch(/height:\s*1px/);
      expect(body).toMatch(/overflow:\s*hidden/);
      expect(body).toMatch(/clip-path:\s*inset\(50%\)/);
    },
  );
});
