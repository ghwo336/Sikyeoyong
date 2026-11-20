import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');

describe('app/globals.css', () => {
  it('no grey scrollbar anywhere: screens scroll like an app (D-23)', () => {
    expect(css).toMatch(/\*\s*\{\s*scrollbar-width:\s*none;\s*\}/);
    expect(css).toMatch(/\*::-webkit-scrollbar\s*\{\s*display:\s*none;\s*\}/);
  });
});
