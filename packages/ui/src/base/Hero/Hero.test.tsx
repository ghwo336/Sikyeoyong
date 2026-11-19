import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Hero } from './Hero';

const css = readFileSync(resolve(__dirname, 'Hero.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

describe('Hero (Hero.md 테스트 기준)', () => {
  it('puts the picture first, then the words', () => {
    const { container } = render(
      <Hero gap="lg" art={<svg data-testid="art" />}>
        <h1>배달은 용이한테 시켜용</h1>
      </Hero>,
    );
    const root = container.firstElementChild;
    expect(root?.children[0]?.tagName.toLowerCase()).toBe('svg');
    expect(root?.children[1]?.tagName).toBe('H1');
  });

  it('fills the free height and centers both ways', () => {
    const hero = rule('.hero');
    expect(hero).toMatch(/flex-grow:\s*1/);
    expect(hero).toMatch(/align-items:\s*center/);
    expect(hero).toMatch(/justify-content:\s*center/);
  });

  it('keeps the design gaps (Hatch 24, Start 28)', () => {
    expect(rule('.md')).toMatch(/gap:\s*var\(--space-6\)/);
    expect(rule('.lg')).toMatch(/gap:\s*var\(--space-7\)/);
  });
});
