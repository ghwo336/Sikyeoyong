import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LOOK_NOTE, SpeciesPicker } from './SpeciesPicker';

const css = readFileSync(resolve(__dirname, 'SpeciesPicker.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.:[\]]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

describe('SpeciesPicker (SpeciesPicker.md 테스트 기준)', () => {
  it('is a radiogroup named 용이 모습 with the four looks in D-20 order', () => {
    render(<SpeciesPicker value="forest" onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: '용이 모습' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      '숲용',
      '물용',
      '꽃용',
      '별용',
    ]);
  });

  it('checks only the value and draws each card with its own species', () => {
    const { container } = render(<SpeciesPicker value="flower" onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: '꽃용' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByRole('radio', { checked: false })).toHaveLength(3);
    expect([...container.querySelectorAll('svg')].map((s) => s.dataset.species)).toEqual([
      'forest',
      'water',
      'flower',
      'star',
    ]);
  });

  it('picks by press and by arrow keys, entering on the picked one', async () => {
    const onChange = vi.fn();
    render(<SpeciesPicker value="water" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: '별용' }));
    expect(onChange).toHaveBeenLastCalledWith('star');
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1, -1]);
    radios[1]?.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('forest');
  });

  it('says what changes and what stays, the line from the design', () => {
    render(<SpeciesPicker value="forest" onChange={vi.fn()} />);
    expect(screen.getByText(LOOK_NOTE)).toBeInTheDocument();
    expect(LOOK_NOTE).toBe('모습과 말버릇, 앱 색만 바뀌어요. 이름, 용돈, 한도는 그대로예요.');
  });

  it('marks the pick with the theme color (D-32), the Look design values', () => {
    expect(rule('.option')).toMatch(/height:\s*104px/);
    expect(rule('.option')).toMatch(/border:\s*2px solid var\(--color-line\)/);
    expect(rule('.option')).toMatch(/border-radius:\s*var\(--radius-button\)/);
    expect(rule('.option[data-selected]')).toMatch(/border-color:\s*var\(--theme-accent\)/);
    expect(rule('.note')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
  });
});
