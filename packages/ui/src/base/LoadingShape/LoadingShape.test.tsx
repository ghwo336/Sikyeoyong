import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingShape, type LoadingShapeKind } from './LoadingShape';

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
});
