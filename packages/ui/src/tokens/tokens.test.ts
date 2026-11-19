import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain JS build script without type declarations
import { renderTokens } from '../../scripts/build-tokens.mjs';

const render = renderTokens as (t: unknown) => string;
const root = resolve(__dirname, '../../../..');
const json = readFileSync(resolve(root, 'design/tokens.json'), 'utf8');
const tokens = JSON.parse(json) as {
  color: Record<string, string | Record<string, string>>;
  type: Record<
    string,
    { size: number; weight?: number; lineHeight?: number; letterSpacing?: string | number }
  >;
  space: number[];
  radius: Record<string, number>;
  size: Record<string, number>;
  motion: Record<string, string>;
};
const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');
const base = readFileSync(resolve(__dirname, 'base.css'), 'utf8');

// Expected variables built here, independently of the generator.
function kebab(s: string): string {
  let out = '';
  for (const ch of s) out += ch >= 'A' && ch <= 'Z' ? `-${ch.toLowerCase()}` : ch;
  return out;
}

function expectedVars(): Map<string, string> {
  const m = new Map<string, string>();
  for (const [k, v] of Object.entries(tokens.color)) {
    if (typeof v === 'string') m.set(`color-${kebab(k)}`, v);
    else for (const [sk, sv] of Object.entries(v)) m.set(`color-${kebab(k)}-${kebab(sk)}`, sv);
  }
  for (const [k, t] of Object.entries(tokens.type)) {
    m.set(`type-${k}-size`, `${t.size}px`);
    if (t.weight !== undefined) m.set(`type-${k}-weight`, `${t.weight}`);
    if (t.lineHeight !== undefined) m.set(`type-${k}-line-height`, `${t.lineHeight}`);
    if (t.letterSpacing !== undefined) m.set(`type-${k}-letter-spacing`, `${t.letterSpacing}`);
  }
  tokens.space.forEach((v, i) => m.set(`space-${i + 1}`, `${v}px`));
  for (const [k, v] of Object.entries(tokens.radius)) m.set(`radius-${kebab(k)}`, `${v}px`);
  for (const [k, v] of Object.entries(tokens.size)) m.set(`size-${kebab(k)}`, `${v}px`);
  return m;
}

function cssVars(text: string): Map<string, string> {
  return new Map(
    [...text.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((x) => [x[1] ?? '', x[2] ?? '']),
  );
}

describe('tokens.css', () => {
  it('has exactly one variable per design token, with the same value', () => {
    expect(cssVars(css)).toEqual(expectedVars());
  });

  it('is what the generator writes now (run `pnpm --filter @sikyeoyong/ui tokens` after editing tokens.json)', () => {
    expect(css).toBe(render(tokens));
  });

  it('spot checks against the design file by hand', () => {
    expect(css).toContain('--color-leaf: #2E7D4F;');
    expect(css).toContain('--color-dragon-green: #8FD694;');
    expect(css).toContain('--type-title-line-height: 1.35;');
    expect(css).toContain('--type-row-weight: 600;');
    expect(css).toContain('--space-8: 32px;');
    expect(css).toContain('--size-touch-min: 44px;');
  });
});

describe('renderTokens rejects shapes it cannot express', () => {
  const minimal = { color: {}, type: {}, space: [], radius: {}, size: {} };

  it('two levels of color nesting', () => {
    expect(() => render({ ...minimal, color: { a: { b: { c: '#fff' } } } })).toThrow(/one level/);
  });

  it('a non-zero unitless letter spacing', () => {
    expect(() => render({ ...minimal, type: { x: { size: 1, letterSpacing: -0.5 } } })).toThrow(
      /letterSpacing/,
    );
  });
});

describe('base.css (hand-maintained)', () => {
  const vars = cssVars(base);

  it('matches the motion strings in tokens.json', () => {
    expect(tokens.motion.screen).toBe('220ms ease-out');
    expect(vars.get('motion-screen')).toBe('220ms');
    expect(vars.get('motion-screen-easing')).toBe('ease-out');
    expect(tokens.motion.number).toContain('400ms');
    expect(vars.get('motion-number')).toBe('400ms');
  });

  it('puts the design fonts first', () => {
    expect(vars.get('font-ui')?.startsWith("'Pretendard Variable'")).toBe(true);
    expect(vars.get('font-dragon')?.startsWith("'Gowun Dodum'")).toBe(true);
    expect(vars.get('font-code')?.startsWith('ui-monospace')).toBe(true);
  });

  it('does not redefine generated variables', () => {
    for (const name of vars.keys()) expect(cssVars(css).has(name)).toBe(false);
  });
});
