import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DRAGON_SPECIES } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SPECIES_INFO } from '../../dragon/Dragon';
import { EggPicker } from './EggPicker';

const css = readFileSync(resolve(__dirname, 'EggPicker.module.css'), 'utf8');
// The row of eggs is base ChoiceGroup row; its gap lives in ChoiceGroup.module.css.
const groupCss = readFileSync(
  resolve(__dirname, '../../base/ChoiceGroup/ChoiceGroup.module.css'),
  'utf8',
);
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.:[\]]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';
const tokens = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../../design/tokens.json'), 'utf8'),
) as {
  size: { eggHero: number; eggOptionIcon: number };
  dragonSpecies: Record<string, { name: string; line: string }>;
};

// Pattern marks the Egg draws per species (Dragons.dc.html, D-20).
const PATTERN = {
  forest: 'egg-leaves',
  water: 'egg-waves',
  flower: 'egg-petals',
  star: 'egg-stars',
} as const;

describe('EggPicker (EggPicker.md 테스트 기준)', () => {
  it('is a radiogroup named 알 with four eggs in D-20 order', () => {
    render(<EggPicker value="forest" onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: '알' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      '숲용 알',
      '물용 알',
      '꽃용 알',
      '별용 알',
    ]);
  });

  it('moves and picks with arrow keys, entering on the picked egg', async () => {
    const onChange = vi.fn();
    render(<EggPicker value="water" onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1, -1]);
    radios[1]?.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('flower');
    expect(radios[2]).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('star'); // wrapped from forest
  });

  it('picks by click and checks only the value', async () => {
    const onChange = vi.fn();
    render(<EggPicker value="star" onChange={onChange} />);
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'false',
      'true',
    ]);
    await userEvent.click(screen.getByRole('radio', { name: '꽃용 알' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('flower');
  });

  it.each(DRAGON_SPECIES)('shows the %s egg large with its name and line', (species) => {
    const { container } = render(<EggPicker value={species} onChange={vi.fn()} />);
    const big = container.querySelector('svg');
    expect(big).toHaveAttribute('width', String(tokens.size.eggHero));
    // The large egg carries the picked species' pattern, and no other.
    for (const [s, part] of Object.entries(PATTERN)) {
      const found = big?.querySelector(`[data-part="${part}"]`);
      if (s === species) expect(found, part).not.toBeNull();
      else expect(found, part).toBeNull();
    }
    expect(screen.getByText(SPECIES_INFO[species].name)).toBeInTheDocument();
    expect(screen.getByText(`"${SPECIES_INFO[species].line}"`)).toBeInTheDocument();
  });

  it('uses the names and lines from tokens.json dragonSpecies', () => {
    for (const s of DRAGON_SPECIES) {
      expect(SPECIES_INFO[s].name).toBe(tokens.dragonSpecies[s]?.name);
      expect(SPECIES_INFO[s].line).toBe(tokens.dragonSpecies[s]?.line);
    }
  });

  it('draws the small eggs at size.eggOptionIcon', () => {
    render(<EggPicker value="forest" onChange={vi.fn()} />);
    for (const r of screen.getAllByRole('radio')) {
      expect(r.querySelector('svg')).toHaveAttribute('width', String(tokens.size.eggOptionIcon));
    }
  });

  // Name.dc.html 33-47, 78.
  it('matches the design values', () => {
    expect(rule('.option')).toMatch(/width:\s*var\(--size-egg-option\)/);
    expect(rule('.option')).toMatch(/border-radius:\s*calc\(var\(--size-egg-option\) \/ 2\)/);
    expect(rule('.option')).toMatch(/border:\s*2px solid transparent/);
    expect(rule('.option[data-selected]')).toMatch(/border-color:\s*var\(--theme-accent\)/);
    expect(rule('.option[data-selected]')).toMatch(/background:\s*var\(--color-surface\)/);
    expect(groupCss).toMatch(/\.row\s*\{[^}]*gap:\s*var\(--size-summary-gap\)/);
    {
      const { unmount } = render(<EggPicker value="forest" onChange={vi.fn()} />);
      expect(screen.getByRole('radiogroup', { name: '알' }).classList).toContain('row');
      unmount();
    }
    expect(rule('.picker')).toMatch(/gap:\s*var\(--size-limits-gap\)/);
    expect(rule('.name')).toMatch(/font-size:\s*var\(--type-egg-name-size\)/);
    expect(rule('.name')).toMatch(/font-weight:\s*var\(--type-egg-name-weight\)/);
    expect(rule('.line')).toMatch(/font-size:\s*var\(--type-row-size\)/);
    expect(rule('.caption')).toMatch(/gap:\s*2px/);
    expect(rule('.caption')).toMatch(/min-height:\s*var\(--size-egg-caption\)/);
    expect(rule('.line')).toMatch(/font-family:\s*var\(--font-dragon\)/);
    expect(rule('.line')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(rule('.option:focus-visible')).toMatch(/outline:\s*2px solid var\(--theme-accent\)/);
  });
});
