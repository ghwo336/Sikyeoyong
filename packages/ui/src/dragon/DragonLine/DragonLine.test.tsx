import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DragonLine } from './DragonLine';

const css = readFileSync(resolve(__dirname, 'DragonLine.module.css'), 'utf8');
const LONG =
  '비 오니까 국물 어때용? 이번 달은 벌써 21만 원 썼으니까 조금 아껴서 골라 봤어용. 그리고 하나 더 말하자면 오늘은 정말 길게 말해 볼게용.';

describe('DragonLine (DragonLine.md 테스트 기준)', () => {
  it('shows text longer than two lines as is, without truncation', () => {
    render(<DragonLine text={LONG} layout="inline" species="forest" />);
    expect(screen.getByText(LONG)).toBeInTheDocument();
    // no ellipsis or line clamp anywhere in the stylesheet
    expect(css).not.toMatch(/text-overflow|line-clamp|-webkit-box/);
    expect(css).not.toMatch(/\.text\s*\{[^}]*(white-space:\s*nowrap|overflow:\s*hidden)/);
  });

  it('breaks a newline into a second line', () => {
    const { container } = render(
      <DragonLine
        text={'국밥 끓이는 중이에용.\n출발하면 알려 줄게용.'}
        layout="inline"
        species="forest"
      />,
    );
    const p = container.querySelector('p');
    expect(p?.querySelectorAll('br')).toHaveLength(1);
    expect(p?.textContent).toBe('국밥 끓이는 중이에용.출발하면 알려 줄게용.');
  });

  // Done.dc.html 56px dragon with 17px text, Cap.dc.html 128px dragon with 19px text.
  it.each([
    ['inline', '56'],
    ['center', '128'],
  ] as const)('%s layout draws a %spx dragon of the given species and mood', (layout, size) => {
    const { container } = render(
      <DragonLine text="x" layout={layout} species="water" mood="worried" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', size);
    expect(svg).toHaveAttribute('data-species', 'water');
    expect(svg).toHaveAttribute('data-mood', 'worried');
  });

  it('can draw the line without the dragon', () => {
    const { container } = render(
      <DragonLine text="천천히 먹어용" layout="inline" species="forest" avatar={false} />,
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByText('천천히 먹어용')).toBeInTheDocument();
  });

  it('uses the dragon voice font and the design sizes per layout', () => {
    expect(css).toMatch(/\.text\s*\{[^}]*font-family:\s*var\(--font-dragon\)/);
    expect(css).toMatch(/\.inline \.text\s*\{[^}]*font-size:\s*var\(--type-dragon-size\)/);
    expect(css).toMatch(/\.center \.text\s*\{[^}]*font-size:\s*var\(--type-dragon-large-size\)/);
    expect(css).toMatch(/\.center\s*\{[^}]*text-align:\s*center/);
  });
});
