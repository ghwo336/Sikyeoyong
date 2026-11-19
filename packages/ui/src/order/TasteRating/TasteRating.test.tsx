import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import chipStyles from '../../base/Chip/Chip.module.css';
import { TasteRating } from './TasteRating';

const css = readFileSync(resolve(__dirname, 'TasteRating.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

describe('TasteRating (TasteRating.md 테스트 기준)', () => {
  it('hands each of the three values to onPick', async () => {
    const onPick = vi.fn();
    render(<TasteRating menu="돼지국밥" onPick={onPick} />);
    await userEvent.click(screen.getByRole('radio', { name: '또 먹을래' }));
    await userEvent.click(screen.getByRole('radio', { name: '괜찮았어' }));
    await userEvent.click(screen.getByRole('radio', { name: '별로였어' }));
    expect(onPick.mock.calls).toEqual([['again'], ['okay'], ['meh']]);
  });

  it('is a radio group named by the question, three tiles in design order', () => {
    render(<TasteRating menu="돼지국밥" onPick={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: '오늘 돼지국밥 어땠어요?' });
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['또 먹을래', '괜찮았어', '별로였어']);
    for (const r of radios) {
      expect(group).toContainElement(r);
      expect(r).toHaveClass(chipStyles.tile ?? 'tile');
    }
  });

  it('checks only the picked value, none before picking', () => {
    const { rerender } = render(<TasteRating menu="돼지국밥" onPick={vi.fn()} />);
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'false',
    ]);
    rerender(<TasteRating menu="돼지국밥" value="okay" onPick={vi.fn()} />);
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ]);
  });

  it('moves and picks with arrow keys, entering the group once', async () => {
    const onPick = vi.fn();
    render(<TasteRating menu="돼지국밥" value="again" onPick={onPick} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    radios[0]?.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onPick).toHaveBeenLastCalledWith('okay');
    expect(radios[1]).toHaveFocus();
  });

  // Arrived.dc.html 53-59.
  it('matches the design values', () => {
    expect(rule('.rating')).toMatch(/gap:\s*var\(--size-summary-gap\)/);
    expect(rule('.question')).toMatch(/font-size:\s*var\(--type-body-size\)/);
    expect(rule('.question')).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
    expect(rule('.choices')).toMatch(/grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
    expect(rule('.choices')).toMatch(/gap:\s*var\(--space-2\)/);
  });
});
