import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DragonLine } from './DragonLine';

const css = readFileSync(resolve(__dirname, 'DragonLine.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';
const THREE = '첫째 줄이에용.\n둘째 줄이에용.\n셋째 줄도 그대로 보여용.';

describe('DragonLine (DragonLine.md 테스트 기준)', () => {
  it('shows more than two lines as is: every line, no clipping', () => {
    const { container } = render(<DragonLine text={THREE} layout="inline" species="forest" />);
    const p = container.querySelector('p');
    expect(p?.querySelectorAll('br')).toHaveLength(2);
    expect(p?.textContent).toBe('첫째 줄이에용.둘째 줄이에용.셋째 줄도 그대로 보여용.');
    expect(p).not.toHaveAttribute('style');
  });

  it('never clips the text anywhere in the stylesheet', () => {
    // No rule in this file may clip, so check the whole file (container and
    // any selector), with comments removed. overflow-wrap is allowed.
    const code = css.replace(/\/\*[\s\S]*?\*\//g, '').toLowerCase();
    for (const banned of [
      /\boverflow(-[xy])?\s*:/,
      /max-height\s*:/,
      /line-clamp/,
      /text-overflow/,
      /nowrap/,
      /-webkit-box/,
      /clip-path\s*:/,
      /\bcontain\s*:/,
    ]) {
      expect(code, String(banned)).not.toMatch(banned);
    }
  });

  it('keeps a long single line whole', () => {
    const long =
      '비 오니까 국물 어때용? 이번 달은 벌써 21만 원 썼으니까 조금 아껴서 골라 봤어용. 그리고 하나 더 말할게용.';
    render(<DragonLine text={long} layout="chat" species="forest" />);
    expect(screen.getByText(long)).toBeInTheDocument();
  });

  // Main.dc.html 32px, Done.dc.html 56px, Cap.dc.html 128px.
  it.each([
    ['chat', '32'],
    ['inline', '56'],
    ['sheet', '44'],
    ['center', '128'],
    ['greeting', '96'],
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

  it('matches the design layout per screen', () => {
    expect(rule('.text')).toMatch(/font-family:\s*var\(--font-dragon\)/);
    expect(rule('.text')).toMatch(/word-break:\s*keep-all/);
    // Main: top aligned, 10px gap, 17px at line height 1.6, 2px down
    expect(rule('.chat')).toMatch(/align-items:\s*flex-start/);
    expect(rule('.chat')).toMatch(/gap:\s*var\(--size-dragon-chat-gap\)/);
    expect(rule('.chat .text')).toMatch(/line-height:\s*var\(--type-body-line-height\)/);
    expect(rule('.chat .text')).toMatch(/margin-top:\s*2px/);
    // Done: centered, 12px gap, 17px at 1.55
    expect(rule('.inline')).toMatch(/align-items:\s*center/);
    expect(rule('.inline')).toMatch(/gap:\s*var\(--space-3\)/);
    expect(rule('.inline .text')).toMatch(/font-size:\s*var\(--type-dragon-size\)/);
    expect(rule('.inline .text')).toMatch(/line-height:\s*var\(--type-dragon-line-height\)/);
    // Confirm: centered, 12px gap, 18px at 1.5
    expect(rule('.sheet')).toMatch(/align-items:\s*center/);
    expect(rule('.sheet')).toMatch(/gap:\s*var\(--space-3\)/);
    expect(rule('.sheet .text')).toMatch(/font-size:\s*var\(--type-dragon-sheet-size\)/);
    expect(rule('.sheet .text')).toMatch(/line-height:\s*var\(--type-dragon-sheet-line-height\)/);
    // Cap, Blocked: column, centered text, 16px gap, 19px
    expect(rule('.center')).toMatch(/flex-direction:\s*column/);
    expect(rule('.center')).toMatch(/text-align:\s*center/);
    expect(rule('.center')).toMatch(/gap:\s*var\(--space-4\)/);
    expect(rule('.center .text')).toMatch(/font-size:\s*var\(--type-dragon-large-size\)/);
    expect(rule('.center .text')).toMatch(
      /letter-spacing:\s*var\(--type-dragon-large-letter-spacing\)/,
    );
  });

  it('puts what the dragon hands over under its words, in the same column', () => {
    const { container } = render(
      <DragonLine text="골라 봤어용." layout="chat" species="forest">
        <ul aria-label="추천" />
      </DragonLine>,
    );
    const root = container.firstElementChild as HTMLElement;
    // Dragon, then one column: words first, card under them.
    expect(root.children).toHaveLength(2);
    const column = root.children[1] as HTMLElement;
    expect(column.children[0]?.tagName).toBe('P');
    expect(column.children[1]).toBe(screen.getByRole('list', { name: '추천' }));
    expect(rule('.body')).toMatch(/flex-direction:\s*column/);
    expect(rule('.body')).toMatch(/gap:\s*var\(--space-3\)/);
    expect(rule('.body')).toMatch(/min-width:\s*0/);
  });

  it.each([undefined, null, false, ''])(
    'keeps the words right next to the dragon when nothing is handed over (%j)',
    (empty) => {
      const { container } = render(
        <DragonLine text="x" layout="chat" species="forest">
          {empty}
        </DragonLine>,
      );
      const root = container.firstElementChild as HTMLElement;
      expect(root.children).toHaveLength(2);
      expect(root.children[1]?.tagName).toBe('P');
    },
  );

  it('draws the Budget greeting at 20px, 14 from a 96px dragon', () => {
    expect(rule('.greeting')).toMatch(/align-items:\s*center/);
    expect(rule('.greeting')).toMatch(/gap:\s*var\(--size-dragon-greeting-gap\)/);
    expect(rule('.greeting .text')).toMatch(/font-size:\s*var\(--type-dragon-greeting-size\)/);
    expect(rule('.greeting .text')).toMatch(
      /line-height:\s*var\(--type-dragon-greeting-line-height\)/,
    );
  });

  it('draws the sheet dragon at size.dragonSheet from tokens.json', () => {
    const tokens = JSON.parse(
      readFileSync(resolve(__dirname, '../../../../../design/tokens.json'), 'utf8'),
    ) as { size: { dragonSheet: number } };
    const { container } = render(<DragonLine text="x" layout="sheet" species="forest" />);
    expect(container.querySelector('svg')).toHaveAttribute(
      'width',
      String(tokens.size.dragonSheet),
    );
  });

  // Budget.dc.html (D-31): 80, 92, 104 by stage, wings at 3, transform only.
  it.each([
    [1, 'scale(calc(80 / 104))', false],
    [2, 'scale(calc(92 / 104))', false],
    [3, 'none', true],
  ] as const)('greeting stage %s grows the dragon to its size', (stage, transform, wings) => {
    const { container } = render(
      <DragonLine text="x" layout="greeting" species="forest" stage={stage} />,
    );
    const slot = container.querySelector('svg')?.parentElement;
    expect(slot?.getAttribute('data-stage')).toBe(String(stage));
    expect(slot?.classList).toContain('grow');
    expect(container.querySelector('svg')).toHaveAttribute('width', '104');
    expect(rule(`.grow[data-stage='${String(stage)}']`)).toContain(`transform: ${transform}`);
    expect(container.querySelector('[data-part="wings"]') !== null).toBe(wings);
  });

  it('grows with transform only, and not at all under reduced motion', () => {
    expect(rule('.grow')).toMatch(/transition:\s*transform 240ms/);
    expect(css).not.toMatch(/transition:[^;]*\b(width|height)\b/);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.grow\s*\{\s*transition:\s*none;/,
    );
  });

  it('keeps fixed sizes outside greeting, with wings at stage 3 only', () => {
    const { container, rerender } = render(
      <DragonLine text="x" layout="chat" species="forest" stage={3} />,
    );
    expect(container.querySelector('svg')).toHaveAttribute('width', '32');
    expect(container.querySelector('.grow')).toBeNull();
    expect(container.querySelector('[data-part="wings"]')).not.toBeNull();
    rerender(<DragonLine text="x" layout="chat" species="forest" stage={2} />);
    expect(container.querySelector('[data-part="wings"]')).toBeNull();
    rerender(<DragonLine text="x" layout="greeting" species="forest" />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '96');
    expect(container.querySelector('.grow')).toBeNull();
  });
});
