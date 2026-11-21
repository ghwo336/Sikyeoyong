import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PastLine } from './PastLine';

const css = readFileSync(resolve(__dirname, 'PastLine.module.css'), 'utf8');

describe('PastLine (PastLine.md 테스트 기준)', () => {
  it('draws the text and nothing that can be pressed', () => {
    const { container } = render(<PastLine text="돼지국밥 9,000원, 도착함" />);
    expect(screen.getByText('돼지국밥 9,000원, 도착함')).toBeInTheDocument();
    expect(container.querySelectorAll('button, a, [role="button"], [tabindex]')).toHaveLength(0);
  });

  it('stays on one line with an ellipsis, in muted stamp type', () => {
    expect(css).toMatch(/white-space:\s*nowrap/);
    expect(css).toMatch(/text-overflow:\s*ellipsis/);
    expect(css).toMatch(/var\(--color-ink-muted\)/);
  });
});
