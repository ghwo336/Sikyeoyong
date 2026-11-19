import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Every var(--x) a component stylesheet uses must be defined by tokens.css, base.css or the same stylesheet.
// A misspelled token silently falls back to the browser default, so this guards it.
const src = resolve(__dirname, '..');
const defined = new Set(
  ['tokens.css', 'base.css'].flatMap((f) =>
    [...readFileSync(join(__dirname, f), 'utf8').matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]),
  ),
);

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? cssFiles(join(dir, e.name))
      : e.name.endsWith('.module.css')
        ? [join(dir, e.name)]
        : [],
  );
}

describe('component stylesheets use only defined tokens', () => {
  const files = cssFiles(src);

  it('finds the component stylesheets', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.slice(src.length + 1), f]))('%s', (_name, file) => {
    const text = readFileSync(file, 'utf8');
    // Component-local custom properties declared in the same stylesheet count as defined.
    const local = new Set([...text.matchAll(/--([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const used = [...text.matchAll(/var\(--([a-z0-9-]+)/g)].map((m) => m[1]);
    expect(used.filter((v) => !defined.has(v) && !local.has(v))).toEqual([]);
  });
});
