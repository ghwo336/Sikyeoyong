import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DetailRows } from './DetailRows';

const css = readFileSync(resolve(__dirname, 'DetailRows.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

const rows = [
  { label: '결제 수단', value: '용이 용돈' },
  { label: '30일 한도', value: '219,000 / 500,000원' },
];

describe('DetailRows (DetailRows.md 테스트 기준)', () => {
  it('draws term and value pairs in order, as a description list', () => {
    const { container } = render(<DetailRows rows={rows} size="small" gap="tight" />);
    expect(container.querySelector('dl')).not.toBeNull();
    const terms = Array.from(container.querySelectorAll('dt')).map((d) => d.textContent);
    const values = Array.from(container.querySelectorAll('dd')).map((d) => d.textContent);
    expect(terms).toEqual(['결제 수단', '30일 한도']);
    expect(values).toEqual(['용이 용돈', '219,000 / 500,000원']);
    expect(screen.getByText('결제 수단').nextSibling).toHaveTextContent('용이 용돈');
  });

  it('keeps a value node as given (a title on a short hash)', () => {
    render(
      <DetailRows
        rows={[{ label: '결제 기록 번호', value: <span title="0xabcdef">0xab…ef</span> }]}
        size="caption"
        gap="normal"
      />,
    );
    expect(screen.getByText('0xab…ef')).toHaveAttribute('title', '0xabcdef');
  });

  it('draws repeated labels without losing a row', () => {
    const { container } = render(
      <DetailRows
        rows={[
          { label: '한도', value: 'a' },
          { label: '한도', value: 'b' },
        ]}
        size="small"
        gap="loose"
      />,
    );
    expect(container.querySelectorAll('dd')).toHaveLength(2);
  });

  it('puts layout, size, gap and tone on the list', () => {
    const { container, rerender } = render(<DetailRows rows={rows} size="small" gap="tight" />);
    const dl = () => container.querySelector('dl');
    expect([...(dl()?.classList ?? [])]).toEqual(
      expect.arrayContaining(['inline', 'small', 'tight']),
    );
    expect(dl()).toHaveAttribute('data-tone', 'ink');
    rerender(
      <DetailRows rows={rows} layout="stacked" size="caption" gap="loose" tone="secondary" />,
    );
    expect([...(dl()?.classList ?? [])]).toEqual(
      expect.arrayContaining(['stacked', 'caption', 'loose']),
    );
    expect(dl()).toHaveAttribute('data-tone', 'secondary');
  });

  // Done, Receipt, LimitChat (inline) and IdCard (stacked) design values.
  it('matches the design values', () => {
    expect(rule('.caption')).toMatch(/font-size:\s*var\(--type-caption-size\)/);
    expect(rule('.small')).toMatch(/font-size:\s*var\(--type-small-size\)/);
    expect(rule('.tight')).toMatch(/gap:\s*var\(--space-2\)/);
    expect(rule('.normal')).toMatch(/gap:\s*var\(--size-summary-gap\)/);
    expect(rule('.loose')).toMatch(/gap:\s*var\(--size-limits-gap\)/);
    expect(rule('.row')).toMatch(/justify-content:\s*space-between/);
    expect(rule('.label')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(rule('.value')).toMatch(/tabular-nums/);
    expect(rule('.value')).toMatch(/margin:\s*0/);
    expect(rule(".rows[data-tone='secondary'] .value")).toMatch(
      /color:\s*var\(--color-ink-secondary\)/,
    );
    expect(rule('.stacked')).toMatch(/grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(rule('.stacked')).toMatch(/column-gap:\s*var\(--space-3\)/);
    expect(rule('.stacked .label')).toMatch(/color:\s*var\(--color-card-ink\)/);
    expect(rule('.stacked .value')).toMatch(/font-size:\s*var\(--type-row-size\)/);
    expect(rule('.stacked .value')).toMatch(/font-weight:\s*var\(--type-row-weight\)/);
  });
});
