import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import meterStyles from '../../base/Meter/Meter.module.css';
import { OrderConfirmSheet, type OrderConfirmSheetProps } from './OrderConfirmSheet';

const css = readFileSync(resolve(__dirname, 'OrderConfirmSheet.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

// The menu lines and request are OrderLines; their values live in OrderLines.module.css.
const linesCss = readFileSync(resolve(__dirname, '../OrderLines/OrderLines.module.css'), 'utf8');
const linesRule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(linesCss)?.[2] ??
  '';

// Buttons stack in base ActionPair; error lines are base ErrorLine. Their values live there.
const pairCss = readFileSync(
  resolve(__dirname, '../../base/ActionPair/ActionPair.module.css'),
  'utf8',
);
const pairRule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    pairCss,
  )?.[2] ?? '';
const errCss = readFileSync(
  resolve(__dirname, '../../base/ErrorLine/ErrorLine.module.css'),
  'utf8',
);
const errRule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    errCss,
  )?.[2] ?? '';

const won = (n: bigint) => okrwToAokrw(n);
const base: OrderConfirmSheetProps = {
  open: true,
  line: '돼지국밥 시킬게용.\n이대로 괜찮아용?',
  species: 'forest',
  route: '마루국밥 본점에서 회사(역삼동)로, 25분쯤',
  items: [{ name: '돼지국밥', quantity: 1, price: won(9_000n) }],
  request: '깍두기 많이',
  total: won(9_000n),
  perOrder: { used: won(9_000n), max: won(10_000n) },
  period: { used: won(219_000n), max: won(500_000n) },
  onConfirm: () => undefined,
  onCancel: () => undefined,
};

const orderButton = () => screen.getByRole('button', { name: /시키기$/ });

describe('OrderConfirmSheet (OrderConfirmSheet.md 테스트 기준)', () => {
  it('calls onConfirm once even on a fast double tap', () => {
    const onConfirm = vi.fn();
    render(<OrderConfirmSheet {...base} onConfirm={onConfirm} />);
    // Both clicks land before any re-render.
    fireEvent.click(orderButton());
    fireEvent.click(orderButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('opens with focus on the sheet, so a stray Enter does not pay', async () => {
    const onConfirm = vi.fn();
    render(<OrderConfirmSheet {...base} onConfirm={onConfirm} />);
    expect(orderButton()).not.toHaveFocus();
    expect(screen.getByRole('dialog', { name: '주문 확인' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('locks the button while confirming', async () => {
    const onConfirm = vi.fn();
    render(<OrderConfirmSheet {...base} onConfirm={onConfirm} confirming />);
    await userEvent.click(orderButton());
    expect(onConfirm).not.toHaveBeenCalled();
    expect(orderButton()).toHaveAttribute('aria-busy', 'true');
  });

  it('can be pressed again after a failed payment (same order, D-19)', async () => {
    const onConfirm = vi.fn();
    function Parent() {
      const [confirming, setConfirming] = useState(false);
      return (
        <>
          <OrderConfirmSheet
            {...base}
            confirming={confirming}
            onConfirm={() => {
              onConfirm();
              setConfirming(true);
            }}
          />
          <button
            type="button"
            onClick={() => {
              setConfirming(false);
            }}
          >
            실패
          </button>
        </>
      );
    }
    render(<Parent />);
    await userEvent.click(orderButton());
    await userEvent.click(orderButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('실패'));
    await userEvent.click(orderButton());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('shows the amount with formatOkrw on the button and as the total, as given', () => {
    render(
      <OrderConfirmSheet
        {...base}
        items={[{ name: '회식', quantity: 1, price: won(123_456_789_012_345_000n) }]}
        // The server total differs from the line by whole won: it must win, unchanged.
        total={won(123_456_789_012_345_678n)}
      />,
    );
    expect(orderButton()).toHaveAccessibleName('123,456,789,012,345,678원 시키기');
    const order = screen.getByRole('region', { name: '주문 내용' });
    expect(within(order).getByText('결제할 금액').nextSibling).toHaveTextContent(
      '123,456,789,012,345,678원',
    );
  });

  it('shows the order: route, "name N개" lines, request', () => {
    render(<OrderConfirmSheet {...base} />);
    expect(screen.getByText(base.route)).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('돼지국밥 1개9,000원');
    expect(screen.getByText('요청: 깍두기 많이')).toBeInTheDocument();
  });

  it('draws two limit bars, per order and 30 days, with the given numbers', () => {
    render(<OrderConfirmSheet {...base} />);
    const limits = screen.getByRole('region', { name: '용이가 쓸 수 있는 돈' });
    const meters = within(limits).getAllByRole('meter');
    expect(meters.map((m) => m.getAttribute('aria-label'))).toEqual([
      '한 번에',
      '30일 동안 (주문 후)',
    ]);
    // Confirm draws limits (leaf on the line track), not budget bars.
    for (const m of meters) {
      expect(m.parentElement).toHaveClass(meterStyles.limit ?? 'limit');
    }
    expect(meters.map((m) => m.getAttribute('aria-valuetext'))).toEqual([
      '9,000원 / 10,000원',
      '219,000원 / 500,000원',
    ]);
  });

  it('passes the tones from the parent to the bars', () => {
    render(
      <OrderConfirmSheet
        {...base}
        perOrder={{ ...base.perOrder, tone: 'warn' }}
        period={{ ...base.period, tone: 'over' }}
      />,
    );
    const fills = screen.getAllByRole('meter').map((m) => m.firstElementChild);
    expect(fills.map((f) => f?.getAttribute('data-tone'))).toEqual(['warn', 'over']);
  });

  it('cancels with "다시 고를래" and with Escape', async () => {
    const onCancel = vi.fn();
    render(<OrderConfirmSheet {...base} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: '다시 고를래' }));
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('is a dialog named 주문 확인 with the dragon line on top', () => {
    render(<OrderConfirmSheet {...base} />);
    const dialog = screen.getByRole('dialog', { name: '주문 확인' });
    expect(within(dialog).getByText('돼지국밥 시킬게용.')).toBeInTheDocument();
  });

  it('says the price changed only when it did', () => {
    const { rerender } = render(<OrderConfirmSheet {...base} />);
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<OrderConfirmSheet {...base} priceChangedFrom={won(8_500n)} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      '가격이 8,500원에서 9,000원으로 바뀌었어요. 다시 확인해 주세요.',
    );
  });

  // Confirm.dc.html 31-60.
  it('matches the design values', () => {
    expect(rule('.order')).toMatch(/gap:\s*var\(--size-summary-gap\)/);
    render(<OrderConfirmSheet {...base} />);
    expect(screen.getByRole('list').classList).toContain('row');
    expect(linesRule('.row')).toMatch(/gap:\s*var\(--size-summary-gap\)/);
    expect(rule('.route')).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    expect(linesRule('.row')).toMatch(/font-size:\s*var\(--type-row-size\)/);
    expect(linesRule('.request')).toMatch(/font-size:\s*var\(--type-small-size\)/);
    expect(rule('.divider')).toMatch(/margin:\s*var\(--space-1\) 0/);
    expect(rule('.divider')).toMatch(/background:\s*var\(--color-track\)/);
    expect(rule('.totalAmount')).toMatch(/font-size:\s*var\(--type-pay-size\)/);
    expect(rule('.totalAmount')).toMatch(/letter-spacing:\s*var\(--type-pay-letter-spacing\)/);
    expect(rule('.limits')).toMatch(/gap:\s*var\(--size-limits-gap\)/);
    expect(rule('.limitsTitle')).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
    {
      const { unmount } = render(<OrderConfirmSheet {...base} />);
      expect(document.querySelector('.pair')?.classList).toContain('xs');
      unmount();
    }
    expect(pairRule('.xs')).toMatch(/gap:\s*var\(--space-1\)/);
    expect(errRule('.line')).toMatch(/color:\s*var\(--color-over-ink\)/);
    expect(errRule('.line')).toMatch(/font-size:\s*var\(--type-caption-size\)/);
  });
});
