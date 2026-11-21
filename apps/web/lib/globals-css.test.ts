import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');

describe('app/globals.css', () => {
  it('no grey scrollbar anywhere: screens scroll like an app (D-23)', () => {
    expect(css).toMatch(/\*\s*\{\s*scrollbar-width:\s*none;\s*\}/);
    expect(css).toMatch(/\*::-webkit-scrollbar\s*\{\s*display:\s*none;\s*\}/);
  });

  it('the screen transition fades the old screen out before the new one is fully in (QA 4)', () => {
    const old =
      /\n::view-transition-old\(root\)\s*\{([^}]*animation-name[^}]*)\}/.exec(css)?.[1] ?? '';
    const next =
      /\n::view-transition-new\(root\)\s*\{([^}]*animation-name[^}]*)\}/.exec(css)?.[1] ?? '';
    const ms = (rule: string, prop: string) =>
      Number(new RegExp(`${prop}:\\s*(\\d+)ms`).exec(rule)?.[1]);
    expect(ms(old, 'animation-duration')).toBeLessThan(ms(next, 'animation-duration'));
    // The old one is gone by the time the new one is half in: no mid-point overlap.
    expect(ms(old, 'animation-duration')).toBeLessThanOrEqual(
      ms(next, 'animation-delay') + ms(next, 'animation-duration') / 4,
    );
    // Only opacity and transform move.
    const frames = [...css.matchAll(/@keyframes screen-[\w-]+\s*\{([\s\S]*?)\n\}/g)].map(
      (m) => m[1],
    );
    expect(frames).toHaveLength(2);
    for (const f of frames) {
      const props = [...(f ?? '').matchAll(/([a-z-]+):\s*[^;{]+;/g)].map((m) => m[1]);
      expect(props.every((p) => p === 'opacity' || p === 'transform')).toBe(true);
    }
  });

  it('reduced motion turns every named screen transition off, and wins over them', () => {
    const block = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css);
    expect(block).not.toBeNull();
    const body = block?.[1] ?? '';
    for (const part of ['group', 'old', 'new']) {
      expect(body).toContain(`::view-transition-${part}(*)`);
    }
    // Named rules (root) are more specific than (*), so it must be !important.
    expect(body).toMatch(/animation:\s*none\s*!important;/);
    // It is the last block, so nothing declared after it can bring an animation back.
    expect(css.lastIndexOf('@media (prefers-reduced-motion: reduce)')).toBe(
      css.indexOf('@media (prefers-reduced-motion: reduce)'),
    );
    expect(css.lastIndexOf('::view-transition-')).toBeGreaterThan(
      css.indexOf('@media (prefers-reduced-motion: reduce)'),
    );
    expect(css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))).not.toMatch(
      /animation-name/,
    );
  });
});
