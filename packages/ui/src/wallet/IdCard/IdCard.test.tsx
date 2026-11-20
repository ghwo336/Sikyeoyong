import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as shared from '@sikyeoyong/shared';
import { DRAGON_SPECIES, okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatKstDate, IdCard, type IdCardProps } from './IdCard';

const css = readFileSync(resolve(__dirname, 'IdCard.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

// 2026-12-01 09:00 KST
// Label and value pairs are base DetailRows; their values live in DetailRows.module.css.
const rowsCss = readFileSync(
  resolve(__dirname, '../../base/DetailRows/DetailRows.module.css'),
  'utf8',
);
const rowsRule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    rowsCss,
  )?.[2] ?? '';

const BORN = Date.UTC(2026, 11, 1, 0, 0);
const base: IdCardProps = {
  name: '용이',
  ownerName: '이호재',
  perOrder: okrwToAokrw(10_000n),
  ownerVerified: true,
  bornAt: BORN,
  species: 'forest',
};

function fact(term: string) {
  return screen.getByText(term).nextElementSibling?.textContent;
}

describe('IdCard (IdCard.md 테스트 기준)', () => {
  it('uses the shared KST date, not a copy of its own', () => {
    expect(formatKstDate).toBe(shared.formatKstDate);
  });

  it("says '실명 확인 전' when the owner is not verified", () => {
    const { rerender } = render(<IdCard {...base} />);
    expect(fact('주인')).toBe('실명 확인됨');
    rerender(<IdCard {...base} ownerVerified={false} />);
    expect(fact('주인')).toBe('실명 확인 전');
  });

  it('shows the three facts like IdCard.dc.html, with no level (D-31)', () => {
    render(<IdCard {...base} />);
    expect(screen.getByRole('region', { name: '용이 신분증' })).toBeInTheDocument();
    expect(screen.getByText('용이')).toBeInTheDocument();
    expect(screen.getByText('이호재님의 배달 비서')).toBeInTheDocument();
    expect(Array.from(document.querySelectorAll('dt')).map((t) => t.textContent)).toEqual([
      '한 번에',
      '주인',
      '태어난 날',
    ]);
    expect(fact('한 번에')).toBe('10,000원까지');
    expect(fact('태어난 날')).toBe('2026. 12. 1.');
  });

  it('shows the limit past Number exactly', () => {
    render(<IdCard {...base} perOrder={okrwToAokrw(123_456_789_012_345_678n)} />);
    expect(fact('한 번에')).toBe('123,456,789,012,345,678원까지');
  });

  it('dates the birthday in Korea time, whatever the device time zone', () => {
    expect(formatKstDate(Date.UTC(2026, 10, 30, 15, 0))).toBe('2026. 12. 1.'); // 00:00 KST
    expect(formatKstDate(Date.UTC(2026, 10, 30, 14, 59))).toBe('2026. 11. 30.');
  });

  it('grows wings at stage 3: a per-order limit over 30,000 (dragonStage)', () => {
    const { container, rerender } = render(<IdCard {...base} perOrder={okrwToAokrw(30_000n)} />);
    expect(container.querySelector('[data-part="wings"]')).toBeNull();
    rerender(<IdCard {...base} perOrder={okrwToAokrw(35_000n)} />);
    expect(container.querySelector('[data-part="wings"]')).not.toBeNull();
  });

  it.each(DRAGON_SPECIES)('colors the card by species %s', (species) => {
    const { container } = render(<IdCard {...base} species={species} />);
    expect(container.firstElementChild).toHaveAttribute('data-species', species);
    expect(container.querySelector('svg')).toHaveAttribute('width', '64');
    // The portrait is the same species as the card (Dragon head marks, D-20).
    const MARK = {
      forest: 'leaf-crest',
      water: 'fin-ears',
      flower: 'petal-ears',
      star: 'star-horn',
    } as const;
    for (const [s, part] of Object.entries(MARK)) {
      const found = container.querySelector(`svg [data-part="${part}"]`);
      if (s === species) expect(found, part).not.toBeNull();
      else expect(found, part).toBeNull();
    }
  });

  // IdCard.dc.html 25-38.
  it('matches the design values', () => {
    const card = rule('.card');
    expect(card).toMatch(/border:\s*1\.5px solid var\(--color-ink\)/);
    expect(card).toMatch(/border-radius:\s*var\(--radius-id-card\)/);
    expect(card).toMatch(/padding:\s*var\(--space-5\)/);
    expect(card).toMatch(/gap:\s*var\(--size-id-card-gap\)/);
    expect(rule(".card[data-species='forest']")).toMatch(/var\(--color-dragon-green\)/);
    expect(rule(".card[data-species='water']")).toMatch(/var\(--color-dragon-sky\)/);
    expect(rule(".card[data-species='flower']")).toMatch(/var\(--color-dragon-pink\)/);
    expect(rule(".card[data-species='star']")).toMatch(/var\(--color-dragon-violet\)/);
    expect(rule('.portrait')).toMatch(/width:\s*var\(--size-portrait\)/);
    expect(rule('.portrait')).toMatch(/border-radius:\s*var\(--radius-portrait\)/);
    expect(rule('.portrait')).toMatch(/background:\s*var\(--color-egg-shell\)/);
    expect(rule('.name')).toMatch(/font-size:\s*var\(--type-card-name-size\)/);
    // Facts: base DetailRows stacked (two columns, 14 by 12, card-ink labels, 16/600 values).
    const { container } = render(<IdCard {...base} />);
    const dl = container.querySelector('dl');
    expect([...(dl?.classList ?? [])]).toEqual(
      expect.arrayContaining(['stacked', 'caption', 'loose']),
    );
    expect(rowsRule('.loose')).toMatch(/gap:\s*var\(--size-limits-gap\)/);
    expect(rowsRule('.stacked')).toMatch(/column-gap:\s*var\(--space-3\)/);
    expect(rowsRule('.stacked .label')).toMatch(/color:\s*var\(--color-card-ink\)/);
    expect(rowsRule('.stacked .value')).toMatch(/font-size:\s*var\(--type-row-size\)/);
  });
});
