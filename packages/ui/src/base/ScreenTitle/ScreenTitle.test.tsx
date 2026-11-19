import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScreenTitle } from './ScreenTitle';

const css = readFileSync(resolve(__dirname, 'ScreenTitle.module.css'), 'utf8');
// Every block whose selector list ends with this selector, joined (".heading,\n.description" counts).
const rule = (selector: string) =>
  [...css.matchAll(new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`, 'g'))]
    .map((m) => m[2])
    .join('\n');

describe('ScreenTitle (ScreenTitle.md 테스트 기준)', () => {
  it('is the screen heading (h1) with the line under it', () => {
    render(
      <ScreenTitle
        variant="title"
        title={'주인님이 누군지\n한 번만 확인할게요'}
        description="실명 확인된 주인만 비서를 둘 수 있어요."
      />,
    );
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('주인님이 누군지한 번만 확인할게요');
    expect(h1.querySelectorAll('br')).toHaveLength(1);
    expect(screen.getByText('실명 확인된 주인만 비서를 둘 수 있어요.').closest('p')).not.toBeNull();
  });

  it.each([undefined, ''])('draws no line under the heading for %j', (description) => {
    const { container } = render(
      <ScreenTitle variant="title" title="알을 하나 골라" description={description} />,
    );
    expect(container.querySelector('p')).toBeNull();
  });

  it('matches the design sizes for each variant', () => {
    // Start.dc.html 30/700 at 1.3 with 10 between, centered.
    expect(rule('.display')).toMatch(/gap:\s*var\(--size-display-gap\)/);
    expect(rule('.display')).toMatch(/text-align:\s*center/);
    expect(rule('.display .heading')).toMatch(/font-size:\s*var\(--type-display-size\)/);
    expect(rule('.display .heading')).toMatch(/line-height:\s*var\(--type-display-line-height\)/);
    // Verify.dc.html, Name.dc.html 26/700 at 1.35 with 8 between, from the left.
    expect(rule('.title')).toMatch(/gap:\s*var\(--space-2\)/);
    expect(rule('.title')).not.toMatch(/text-align/);
    expect(rule('.title .heading')).toMatch(/font-size:\s*var\(--type-title-size\)/);
    // Hatch.dc.html: the dragon's voice 22 with a 14px line.
    expect(rule('.dragon .heading')).toMatch(/font-family:\s*var\(--font-dragon\)/);
    expect(rule('.dragon .heading')).toMatch(/font-size:\s*var\(--type-dragon-hero-size\)/);
    expect(rule('.dragon .description')).toMatch(/font-size:\s*var\(--type-small-size\)/);
    // The line under any heading is 15px secondary ink by default.
    expect(rule('.description')).toMatch(/font-size:\s*var\(--type-body-size\)/);
    expect(rule('.description')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
  });

  it('never clips a long heading', () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/overflow\s*:|text-overflow|line-clamp|nowrap/);
  });
});
