import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OrderLines } from './OrderLines';

const css = readFileSync(resolve(__dirname, 'OrderLines.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

const won = (n: bigint) => okrwToAokrw(n);
const items = [
  { name: '돼지국밥', quantity: 1, price: won(9_000n) },
  { name: '김밥', quantity: 2, price: won(7_000n) },
];

describe('OrderLines (OrderLines.md 테스트 기준)', () => {
  it('draws "name N개" and the line price with formatOkrw, in order', () => {
    render(<OrderLines items={items} size="body" />);
    const lines = screen.getAllByRole('listitem');
    expect(lines.map((l) => l.textContent)).toEqual(['돼지국밥 1개9,000원', '김밥 2개7,000원']);
  });

  it('shows line prices past Number exactly', () => {
    render(
      <OrderLines
        items={[{ name: '국밥', quantity: 1, price: won(123_456_789_012_345_678n) }]}
        size="row"
      />,
    );
    expect(screen.getByText('123,456,789,012,345,678원')).toBeInTheDocument();
  });

  it('shows the request with its prefix, and nothing when empty or missing', () => {
    const { rerender, container } = render(
      <OrderLines items={items} size="body" request="깍두기 많이" />,
    );
    expect(screen.getByText('요청: 깍두기 많이')).toBeInTheDocument();
    rerender(<OrderLines items={items} size="body" request="" />);
    expect(container.querySelector('p')).toBeNull();
    rerender(<OrderLines items={items} size="body" />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('puts the size class on the list', () => {
    const { rerender } = render(<OrderLines items={items} size="body" />);
    expect(screen.getByRole('list').classList).toContain('body');
    rerender(<OrderLines items={items} size="row" />);
    expect(screen.getByRole('list').classList).toContain('row');
  });

  // Done.dc.html, Receipt.dc.html: 15px, 8 apart. Confirm.dc.html: 16px, 10 apart.
  it('matches the design values', () => {
    expect(rule('.body')).toMatch(/gap:\s*var\(--space-2\)/);
    expect(rule('.body')).toMatch(/font-size:\s*var\(--type-body-size\)/);
    expect(rule('.row')).toMatch(/gap:\s*var\(--size-summary-gap\)/);
    expect(rule('.row')).toMatch(/font-size:\s*var\(--type-row-size\)/);
    expect(rule('.line')).toMatch(/justify-content:\s*space-between/);
    expect(rule('.request')).toMatch(/font-size:\s*var\(--type-small-size\)/);
    expect(rule('.request')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(rule('.num')).toMatch(/tabular-nums/);
  });
});
