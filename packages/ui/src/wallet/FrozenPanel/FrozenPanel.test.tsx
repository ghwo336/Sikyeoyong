import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FrozenPanel } from './FrozenPanel';

const css = readFileSync(resolve(__dirname, 'FrozenPanel.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';
const tokens = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../../design/tokens.json'), 'utf8'),
) as { size: { eggSleeping: number } };

const won = (n: bigint) => okrwToAokrw(n);
const base = {
  pocket: won(20_000n),
  species: 'forest' as const,
  onRefund: vi.fn(),
  onWake: vi.fn(),
};

describe('FrozenPanel (FrozenPanel.md 테스트 기준)', () => {
  it('hides take-back when the pocket is 0', () => {
    const { rerender } = render(<FrozenPanel {...base} />);
    expect(screen.getByRole('button', { name: '돌려받기' })).toBeInTheDocument();
    rerender(<FrozenPanel {...base} pocket={0n} />);
    expect(screen.queryByRole('button', { name: '돌려받기' })).toBeNull();
    expect(screen.getByText('0원 남음')).toBeInTheDocument();
  });

  it('takes back once, and not again while refunding', async () => {
    const onRefund = vi.fn();
    const { rerender } = render(<FrozenPanel {...base} onRefund={onRefund} />);
    await userEvent.click(screen.getByRole('button', { name: '돌려받기' }));
    expect(onRefund).toHaveBeenCalledTimes(1);
    rerender(<FrozenPanel {...base} onRefund={onRefund} refunding />);
    const button = screen.getByRole('button', { name: '돌려받기' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onRefund).toHaveBeenCalledTimes(1);
  });

  it('wakes with the big button', async () => {
    const onWake = vi.fn();
    render(<FrozenPanel {...base} onWake={onWake} />);
    await userEvent.click(screen.getByRole('button', { name: '용이 깨우기' }));
    expect(onWake).toHaveBeenCalledTimes(1);
  });

  it('draws the sleeping egg of the species, with Zz, at size.eggSleeping', () => {
    const { container } = render(<FrozenPanel {...base} species="water" />);
    const egg = container.querySelector('svg');
    expect(egg).toHaveAttribute('width', String(tokens.size.eggSleeping));
    expect(egg?.querySelector('[data-part="zz"]')).not.toBeNull();
    expect(egg?.querySelector('[data-part="egg-waves"]')).not.toBeNull();
  });

  it('says the design words and the pocket with formatOkrw', () => {
    render(<FrozenPanel {...base} pocket={won(123_456_789_012_345_678n)} />);
    expect(screen.getByText('용이가 자고 있어요')).toBeInTheDocument();
    expect(screen.getByText('모든 주문이 멈췄어요')).toBeInTheDocument();
    expect(screen.getByText('123,456,789,012,345,678원 남음')).toBeInTheDocument();
  });

  // Frozen.dc.html 26-41.
  it('matches the design values', () => {
    expect(rule('.sleep')).toMatch(/gap:\s*var\(--size-sleep-gap\)/);
    expect(rule('.heading')).toMatch(/gap:\s*var\(--size-sleep-heading-gap\)/);
    expect(rule('.title')).toMatch(/font-size:\s*var\(--type-title-size\)/);
    expect(rule('.subtitle')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(rule('.pocketRow')).toMatch(/border-top:\s*1px solid var\(--color-sleep-line\)/);
    expect(rule('.pocketRow')).toMatch(/padding-top:\s*var\(--size-pocket-top\)/);
    expect(rule('.pocketLabel')).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
    expect(rule('.pocketLeft')).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    const refund = rule('.refund');
    expect(refund).toMatch(/min-height:\s*var\(--size-touch-min\)/);
    expect(refund).toMatch(/border:\s*1px solid var\(--color-ink\)/);
    expect(refund).toMatch(/border-radius:\s*var\(--radius-chip\)/);
    expect(refund).toMatch(/padding:\s*0 var\(--size-pill-pad-x\)/);
  });
});
