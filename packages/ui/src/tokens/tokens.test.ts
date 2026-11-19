import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain JS build script without type declarations
import { renderTokens } from '../../scripts/build-tokens.mjs';

const root = resolve(__dirname, '../../../..');
const tokens = JSON.parse(readFileSync(resolve(root, 'design/tokens.json'), 'utf8')) as unknown;
const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');

describe('tokens.css', () => {
  it('matches design/tokens.json (run `pnpm --filter @sikyeoyong/ui tokens` after editing it)', () => {
    expect(css).toBe((renderTokens as (t: unknown) => string)(tokens));
  });

  it('carries the design colors exactly', () => {
    expect(css).toContain('--color-leaf: #2E7D4F;');
    expect(css).toContain('--color-yolk: #FFD15C;');
    expect(css).toContain('--color-over: #E0A230;');
    expect(css).toContain('--color-dragon-green: #8FD694;');
  });

  it('carries type, space, radius and size scales in px', () => {
    expect(css).toContain('--type-body-size: 15px;');
    expect(css).toContain('--type-body-letter-spacing: -0.01em;');
    expect(css).toContain('--space-4: 16px;');
    expect(css).toContain('--radius-sheet: 28px;');
    expect(css).toContain('--size-touch-min: 44px;');
  });
});
