import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OrderSummary } from './OrderSummary';
import styles from './OrderSummary.module.css';

const css = readFileSync(resolve(__dirname, 'OrderSummary.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

// The menu lines and request are OrderLines; their values live in OrderLines.module.css.
const linesCss = readFileSync(resolve(__dirname, '../OrderLines/OrderLines.module.css'), 'utf8');
const linesRule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(linesCss)?.[2] ??
  '';

const won = (n: bigint) => okrwToAokrw(n);
const STORE = '마루국밥 본점에서 회사(역삼동)로';

function total(container: HTMLElement) {
  return container.querySelector(`.${styles.totalAmount}`)?.textContent;
}

describe('OrderSummary (OrderSummary.md 테스트 기준)', () => {
  it('shows the total exactly as the server gave it, never the sum of lines', () => {
    const { container } = render(
      <OrderSummary
        store={STORE}
        items={[
          { name: '어묵탕', quantity: 1, price: won(5_000n) },
          { name: '김밥', quantity: 2, price: won(7_000n) },
        ]}
        total={won(11_500n)} // a discount the server applied
      />,
    );
    expect(total(container)).toBe('11,500원');
  });

  it('keeps sub-won aokrw out of the display (formatOkrw rounds toward zero)', () => {
    const { container } = render(
      <OrderSummary store={STORE} items={[]} total={won(9_000n) + 999n} />,
    );
    expect(total(container)).toBe('9,000원');
  });

  it('keeps amounts past Number exact (hand-written expectation)', () => {
    const { container } = render(
      <OrderSummary
        store={STORE}
        items={[{ name: '회식', quantity: 1, price: won(123_456_789_012_345_678n) }]}
        total={won(123_456_789_012_345_678n)}
      />,
    );
    expect(total(container)).toBe('123,456,789,012,345,678원');
    expect(screen.getByRole('listitem')).toHaveTextContent('123,456,789,012,345,678원');
  });

  it('shows each line as "name N개" with its price', () => {
    render(
      <OrderSummary
        store={STORE}
        items={[
          { name: '돼지국밥', quantity: 1, price: won(9_000n) },
          { name: '김밥', quantity: 2, price: won(7_000n) },
        ]}
        total={won(16_000n)}
      />,
    );
    const lines = screen.getAllByRole('listitem');
    expect(lines.map((l) => l.textContent)).toEqual(['돼지국밥 1개9,000원', '김밥 2개7,000원']);
  });

  it('shows the request with its prefix, and nothing when there is none', () => {
    const { rerender } = render(
      <OrderSummary store={STORE} items={[]} total={0n} request="깍두기 많이" />,
    );
    expect(screen.getByText('요청: 깍두기 많이')).toBeInTheDocument();
    rerender(<OrderSummary store={STORE} items={[]} total={0n} />);
    expect(screen.queryByText(/요청:/)).toBeNull();
    rerender(<OrderSummary store={STORE} items={[]} total={0n} request="" />);
    expect(screen.queryByText(/요청:/)).toBeNull();
  });

  it('labels the card and the total like Done', () => {
    render(<OrderSummary store={STORE} items={[]} total={won(9_000n)} />);
    const card = screen.getByRole('region', { name: '주문 내용' });
    expect(within(card).getByText('결제한 금액')).toBeInTheDocument();
    expect(within(card).getByText(STORE)).toBeInTheDocument();
  });

  it('shows Receipt time and detail rows as term and value pairs', () => {
    const { container } = render(
      <OrderSummary
        store="마루국밥 본점"
        when="12월 9일 12시 31분"
        items={[]}
        total={won(9_000n)}
        details={[
          { label: '결제 수단', value: '용이 용돈' },
          { label: '30일 한도', value: '219,000 / 500,000원' },
        ]}
      />,
    );
    expect(screen.getByText('12월 9일 12시 31분')).toBeInTheDocument();
    const terms = Array.from(container.querySelectorAll('dt')).map((d) => d.textContent);
    const values = Array.from(container.querySelectorAll('dd')).map((d) => d.textContent);
    expect(terms).toEqual(['결제 수단', '30일 한도']);
    expect(values).toEqual(['용이 용돈', '219,000 / 500,000원']);
  });

  it('has no detail list or time without them', () => {
    const { container } = render(<OrderSummary store={STORE} items={[]} total={0n} details={[]} />);
    expect(container.querySelector('dl')).toBeNull();
    expect(container.querySelector(`.${styles.head}`)?.children).toHaveLength(1);
  });

  // Done.dc.html 49-59, Receipt.dc.html 27-35.
  it('matches the design values', () => {
    const card = rule('.card');
    expect(card).toMatch(/padding:\s*var\(--space-4\)/);
    expect(card).toMatch(/gap:\s*var\(--size-summary-gap\)/);
    expect(card).toMatch(/border:\s*1px solid var\(--color-line\)/);
    expect(card).toMatch(/border-radius:\s*var\(--radius-card\)/);
    expect(rule('.head')).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    expect(rule('.head')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    render(<OrderSummary store={STORE} items={[]} total={0n} />);
    expect(screen.getByRole('list').classList).toContain('body');
    expect(linesRule('.body')).toMatch(/font-size:\s*var\(--type-body-size\)/);
    expect(linesRule('.request')).toMatch(/font-size:\s*var\(--type-small-size\)/);
    expect(rule('.divider')).toMatch(/background:\s*var\(--color-track\)/);
    expect(rule('.divider')).toMatch(/margin:\s*2px 0/);
    expect(linesRule('.body')).toMatch(/gap:\s*var\(--space-2\)/);
    expect(rule('.totalLabel')).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
    expect(rule('.totalAmount')).toMatch(/font-size:\s*var\(--type-total-size\)/);
    expect(rule('.totalAmount')).toMatch(/font-weight:\s*var\(--type-total-weight\)/);
    expect(rule('.details')).toMatch(/font-size:\s*var\(--type-small-size\)/);
    expect(rule('.num')).toMatch(/tabular-nums/);
  });
});
