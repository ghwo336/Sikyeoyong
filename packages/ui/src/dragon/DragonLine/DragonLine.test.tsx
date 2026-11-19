import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DragonLine } from './DragonLine';

const css = readFileSync(resolve(__dirname, 'DragonLine.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';
const THREE = '첫째 줄이에용.\n둘째 줄이에용.\n셋째 줄도 그대로 보여용.';

describe('DragonLine (DragonLine.md 테스트 기준)', () => {
  it('shows more than two lines as is: every line, no clipping', () => {
    const { container } = render(<DragonLine text={THREE} layout="inline" species="forest" />);
    const p = container.querySelector('p');
    expect(p?.querySelectorAll('br')).toHaveLength(2);
    expect(p?.textContent).toBe('첫째 줄이에용.둘째 줄이에용.셋째 줄도 그대로 보여용.');
    expect(p).not.toHaveAttribute('style');
  });

  it('never clips the text in any layout rule', () => {
    const textRules = ['.text', '.chat .text', '.inline .text', '.center .text']
      .map(rule)
      .join('\n');
    for (const banned of [
      'max-height',
      'overflow:',
      'line-clamp',
      'text-overflow',
      'nowrap',
      '-webkit-box',
    ]) {
      expect(textRules, banned).not.toContain(banned);
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
    // Cap, Blocked: column, centered text, 16px gap, 19px
    expect(rule('.center')).toMatch(/flex-direction:\s*column/);
    expect(rule('.center')).toMatch(/text-align:\s*center/);
    expect(rule('.center')).toMatch(/gap:\s*var\(--space-4\)/);
    expect(rule('.center .text')).toMatch(/font-size:\s*var\(--type-dragon-large-size\)/);
    expect(rule('.center .text')).toMatch(
      /letter-spacing:\s*var\(--type-dragon-large-letter-spacing\)/,
    );
  });
});
