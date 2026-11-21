import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  LoadingShape,
  ORDER_HEADER_HEIGHT,
  SUMMARY_CARD_HEIGHT,
  type LoadingShapeKind,
} from './LoadingShape';

const partCss = (path: string) => readFileSync(resolve(__dirname, '../..', path), 'utf8');
const tokensIn = (text: string) => new Set(text.match(/--[a-z0-9-]+/g));

const css = readFileSync(resolve(__dirname, 'LoadingShape.module.css'), 'utf8');

describe('LoadingShape (LoadingShape.md 테스트 기준)', () => {
  const kinds: LoadingShapeKind[] = ['chatHeader', 'meter', 'orderStatus', 'rows', 'detail'];

  it.each(kinds)('%s is hidden from screen readers and draws grey bars', (kind) => {
    const { container } = render(<LoadingShape kind={kind} data-part="loading" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute('aria-hidden', 'true');
    expect(root).toHaveAttribute('data-shape', kind);
    expect(root).toHaveAttribute('data-part', 'loading');
    expect(root.querySelectorAll('span').length).toBeGreaterThan(0);
  });

  it('rows draws as many rows as asked', () => {
    const { container } = render(<LoadingShape kind="rows" count={4} />);
    expect(container.querySelectorAll('[data-shape="rows"] > div')).toHaveLength(4);
  });

  it('never moves: no animation or transition', () => {
    expect(css).not.toMatch(/animation|transition|@keyframes/);
  });

  it('orderStatus and detail blocks are sized from the tokens the real parts use', () => {
    const header = partCss('order/OrderStatusHeader/OrderStatusHeader.module.css');
    const summary = partCss('order/OrderSummary/OrderSummary.module.css');
    const headerTokens = tokensIn(header);
    for (const token of tokensIn(ORDER_HEADER_HEIGHT)) {
      if (token === '--type-display-line-height' || token === '--type-body-line-height') continue;
      expect(headerTokens, token).toContain(token);
    }
    const summaryTokens = tokensIn(summary);
    for (const token of tokensIn(SUMMARY_CARD_HEIGHT)) {
      if (token === '--type-body-line-height') continue;
      expect(summaryTokens, token).toContain(token);
    }
    // The skeleton blocks use them, not a literal.
    const { container } = render(<LoadingShape kind="orderStatus" />);
    const heights = [...container.querySelectorAll<HTMLElement>('span')].map((e) => e.style.height);
    expect(heights).toContain(ORDER_HEADER_HEIGHT);
    expect(heights).toContain(SUMMARY_CARD_HEIGHT);
    expect(heights.some((h) => /^\d+px$/.test(h))).toBe(false);
  });
});
