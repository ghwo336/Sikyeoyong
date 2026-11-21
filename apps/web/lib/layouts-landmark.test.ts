import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Every route layout that draws the screen frame makes it the page's one <main> landmark
// (a11y: axe landmark-one-main and region). A div there would leave the screen with no landmark.
const appDir = resolve(__dirname, '../app');

function layouts(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return layouts(path);
    return name === 'layout.tsx' ? [path] : [];
  });
}

const screenLayouts = layouts(appDir).filter((p) => readFileSync(p, 'utf8').includes('"screen'));

describe('route layouts and the main landmark', () => {
  it('finds the screen layouts, so this check is not empty', () => {
    expect(screenLayouts.length).toBeGreaterThanOrEqual(10);
  });

  it.each(screenLayouts.map((p) => [p.slice(appDir.length + 1), readFileSync(p, 'utf8')]))(
    '%s frames the screen with one <main>',
    (_file, source) => {
      expect(source).toMatch(/<main className="screen/);
      expect(source).not.toMatch(/<div className="screen/);
      expect(source.match(/<main\b/g)).toHaveLength(1);
    },
  );
});
