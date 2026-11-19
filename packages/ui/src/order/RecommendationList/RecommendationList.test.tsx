import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecommendationList } from './RecommendationList';

const css = readFileSync(resolve(__dirname, 'RecommendationList.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.:]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

const ITEMS = [
  {
    id: 'gukbap',
    store: '마루국밥 본점',
    eta: '25분',
    menu: '돼지국밥',
    price: okrwToAokrw(9_000n),
  },
  {
    id: 'eomuk',
    store: '대청분식',
    eta: '20분',
    menu: '어묵탕과 김밥',
    price: okrwToAokrw(8_500n),
  },
  {
    id: 'bossam',
    store: '한상보쌈',
    eta: '35분',
    menu: '보쌈 정식',
    price: okrwToAokrw(12_000n),
    needsApproval: true,
  },
];

describe('RecommendationList (RecommendationList.md 테스트 기준)', () => {
  it("shows '허락 필요' only on rows that need approval", () => {
    render(<RecommendationList items={ITEMS} onPick={vi.fn()} />);
    const rows = screen.getAllByRole('button');
    expect(rows.map((r) => within(r).queryByText('허락 필요') !== null)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('shows prices with formatOkrw', () => {
    render(<RecommendationList items={ITEMS} onPick={vi.fn()} />);
    expect(screen.getByText('9,000원')).toBeInTheDocument();
    expect(screen.getByText('8,500원')).toBeInTheDocument();
    expect(screen.getByText('12,000원')).toBeInTheDocument();
  });

  it('shows store, time and menu like the design, one button per item in order', () => {
    render(<RecommendationList items={ITEMS} onPick={vi.fn()} />);
    const rows = screen.getAllByRole('button');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('마루국밥 본점, 25분돼지국밥9,000원');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('hands the picked id to onPick once', async () => {
    const onPick = vi.fn();
    render(<RecommendationList items={ITEMS} onPick={onPick} />);
    await userEvent.click(screen.getByRole('button', { name: /보쌈 정식/ }));
    expect(onPick).toHaveBeenCalledExactlyOnceWith('bossam');
  });

  it('draws dividers only between rows', () => {
    const { container } = render(<RecommendationList items={ITEMS} onPick={vi.fn()} />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });

  it('shows three busy skeleton rows while loading, and no buttons', () => {
    const { container } = render(<RecommendationList items={ITEMS} onPick={vi.fn()} loading />);
    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelectorAll('[data-part="skeleton"]')).toHaveLength(3);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws nothing when there is nothing to recommend', () => {
    const { container } = render(<RecommendationList items={[]} onPick={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  // Main.dc.html 46-74.
  it('matches the design values', () => {
    const card = rule('.card');
    expect(card).toMatch(/border:\s*1px solid var\(--color-line\)/);
    expect(card).toMatch(/border-radius:\s*var\(--radius-card\)/);
    expect(card).toMatch(/background:\s*var\(--color-surface\)/);
    const row = rule('.row');
    expect(row).toMatch(/min-height:\s*var\(--size-pick-row\)/);
    expect(row).toMatch(/padding:\s*var\(--size-pick-row-pad-y\) var\(--space-4\)/);
    expect(row).toMatch(/gap:\s*var\(--space-3\)/);
    expect(rule('.divider')).toMatch(/background:\s*var\(--color-track\)/);
    expect(rule('.divider')).toMatch(/margin:\s*0 var\(--space-4\)/);
    expect(rule('.text')).toMatch(/gap:\s*var\(--size-pick-meta-gap\)/);
    expect(rule('.meta')).toMatch(/font-size:\s*var\(--type-meta-size\)/);
    expect(rule('.meta')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(rule('.menu')).toMatch(/font-weight:\s*var\(--type-row-weight\)/);
    expect(rule('.price')).toMatch(/tabular-nums/);
    const badge = rule('.badge');
    expect(badge).toMatch(/background:\s*var\(--color-yolk-tint\)/);
    expect(badge).toMatch(/color:\s*var\(--color-yolk-ink\)/);
    expect(badge).toMatch(/font-size:\s*var\(--type-badge-size\)/);
    expect(badge).toMatch(/padding:\s*var\(--size-badge-pad-y\) var\(--size-badge-pad-x\)/);
    expect(rule('.row:focus-visible')).toMatch(/outline:\s*2px solid var\(--color-leaf\)/);
    expect(css).not.toMatch(/@keyframes|animation/);
  });
});
