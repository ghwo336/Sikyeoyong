import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DRAGON_SPECIES } from '@sikyeoyong/shared';
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
  dragonSpecies: Record<string, unknown>;
};
type Theme = Record<'accent' | 'bg' | 'tint' | 'dark' | 'body', string>;
const css = readFileSync(resolve(__dirname, 'tokens.css'), 'utf8');
// The first block is :root with the design tokens; the species theme blocks follow (D-32).
const rootBlock = css.slice(0, css.indexOf('}') + 1);
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
    m.set(`type-${kebab(k)}-size`, `${t.size}px`);
    if (t.weight !== undefined) m.set(`type-${kebab(k)}-weight`, `${t.weight}`);
    if (t.lineHeight !== undefined) m.set(`type-${kebab(k)}-line-height`, `${t.lineHeight}`);
    if (t.letterSpacing !== undefined)
      m.set(`type-${kebab(k)}-letter-spacing`, `${t.letterSpacing}`);
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
    expect(cssVars(rootBlock)).toEqual(expectedVars());
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
    expect(css).toContain('--type-button-sub-size: 16px;');
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

  it('the neutral track follows the theme on every theme-setting element (D-32, browser QA 2)', () => {
    const block = /:root,\s*\[data-species\],\s*\[data-theme='fixed'\]\s*\{([^}]*)\}/.exec(
      base,
    )?.[1];
    expect(block).toMatch(
      /--theme-track:\s*color-mix\(in srgb, var\(--theme-dark\) 4%, var\(--theme-bg\)\)/,
    );
  });

  it('matches the motion strings in tokens.json', () => {
    expect(tokens.motion.screen).toBe('220ms ease-out');
    expect(vars.get('motion-screen')).toBe('220ms');
    expect(vars.get('motion-screen-easing')).toBe('ease-out');
    expect(tokens.motion.typing).toMatch(/^1200ms,/);
    expect(vars.get('motion-typing')).toBe('1200ms');
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

describe('dragonSpecies in tokens.json (D-20)', () => {
  it('lists exactly the species shared code knows, each with a known dragon color', () => {
    const species = Object.keys(tokens.dragonSpecies).filter((k) => !k.startsWith('_'));
    expect(species).toEqual([...DRAGON_SPECIES]);
    const dragonColors = tokens.color.dragon as Record<string, string>;
    for (const s of species) {
      const color = (tokens.dragonSpecies[s] as { color: string }).color;
      expect(dragonColors[color], `${s} color ${color}`).toBeDefined();
    }
  });
});

describe('species themes in tokens.css (D-32)', () => {
  const themeOf = (s: string) => (tokens.dragonSpecies[s] as { theme: Theme }).theme;
  const block = (selector: string) => {
    const at = css.indexOf(selector);
    expect(at, selector).toBeGreaterThan(-1);
    return cssVars(css.slice(at, css.indexOf('}', at) + 1));
  };
  const expected = (t: Theme) =>
    new Map(Object.entries(t).map(([k, v]) => [`theme-${k}`, v] as [string, string]));

  it.each([...DRAGON_SPECIES])('%s has its five theme colors under data-species', (s) => {
    expect(block(`[data-species='${s}']`)).toEqual(expected(themeOf(s)));
  });

  it('forest is the default and the fixed theme, and equals the app leaf colors', () => {
    expect(css).toContain(":root,\n[data-species='forest'],\n[data-theme='fixed'] {");
    const leaf = themeOf('forest');
    expect(leaf.accent).toBe(tokens.color.leaf);
    expect(leaf.dark).toBe(tokens.color.leafPressed);
    expect(leaf.tint).toBe(tokens.color.leafTint);
    expect(leaf.bg).toBe(tokens.color.ground);
  });

  it('refuses a theme without all five colors', () => {
    const minimal = { color: {}, type: {}, space: [], radius: {}, size: {} };
    expect(() =>
      render({ ...minimal, dragonSpecies: { forest: { theme: { accent: '#000' } } } }),
    ).toThrow(/exactly/);
  });
});
