import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from '../Switch';
import { ListRow } from './ListRow';
import styles from './ListRow.module.css';

const css = readFileSync(resolve(__dirname, 'ListRow.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.:[\]'=]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

describe('ListRow (ListRow.md 테스트 기준)', () => {
  it('is a button when onPress is given, and presses once', async () => {
    const onPress = vi.fn();
    const { container } = render(
      <ListRow label="이번 달 예산" value="300,000원" trailing="chevron" onPress={onPress} />,
    );
    const row = screen.getByRole('button', { name: /이번 달 예산/ });
    expect(row).toBe(container.firstElementChild);
    expect(row).toHaveAttribute('type', 'button');
    await userEvent.click(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is a plain div without onPress', () => {
    const { container } = render(<ListRow label="30일 한도" value="219,000 / 500,000원" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.firstElementChild?.tagName).toBe('DIV');
    expect(container.firstElementChild?.className).not.toContain(styles.pressable);
  });

  it('shows label then value, as given (no math)', () => {
    const { container } = render(<ListRow label="30일 한도" value="219,000 / 500,000원" />);
    const parts = Array.from(container.firstElementChild?.children ?? []);
    expect(parts[0]?.textContent).toBe('30일 한도');
    expect(parts[1]?.textContent).toBe('219,000 / 500,000원');
    expect(parts[1]).toHaveAttribute('data-tone', 'default');
  });

  it('marks the accent value', () => {
    render(<ListRow label="이번 달 아낀 돈" value="32,000원" tone="accent" />);
    expect(screen.getByText('32,000원')).toHaveAttribute('data-tone', 'accent');
  });

  it("draws the Wallet arrow for 'chevron'", () => {
    const { container } = render(
      <ListRow label="용이 신분증" value="레벨 1" trailing="chevron" onPress={vi.fn()} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveClass(styles.icon ?? 'icon');
    expect(svg?.querySelector('path')).toHaveAttribute('d', 'M9 6l6 6-6 6');
    expect(container.querySelector(`.${styles.gap}`)).toBeNull();
  });

  it('keeps a 16px gap with no trailing so values line up', () => {
    const { container } = render(<ListRow label="30일 한도" value="1" />);
    const last = container.firstElementChild?.lastElementChild;
    expect(last).toHaveClass(styles.gap ?? 'gap');
    expect(container.querySelector('svg')).toBeNull();
  });

  it.each([null, false, ''])('keeps the gap for trailing %j too', (trailing) => {
    const { container } = render(<ListRow label="30일 한도" value="1" trailing={trailing} />);
    expect(container.firstElementChild?.lastElementChild).toHaveClass(styles.gap ?? 'gap');
  });

  it('names a switch with the row label through the label id', async () => {
    function Row() {
      const [on, setOn] = useState(false);
      return (
        <ListRow
          label="용이 멈추기"
          trailing={(id) => <Switch checked={on} onChange={setOn} labelId={id} />}
        />
      );
    }
    render(<Row />);
    const sw = screen.getByRole('switch', { name: '용이 멈추기' });
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('gives each row its own label id', () => {
    render(
      <>
        <ListRow
          label="용이 멈추기"
          trailing={(id) => <Switch checked={false} onChange={vi.fn()} labelId={id} />}
        />
        <ListRow
          label="자세히 보기"
          trailing={(id) => <Switch checked onChange={vi.fn()} labelId={id} />}
        />
      </>,
    );
    expect(screen.getByRole('switch', { name: '용이 멈추기' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '자세히 보기' })).toBeInTheDocument();
  });

  // Wallet.dc.html 37-41.
  it('matches the design values', () => {
    const row = rule('.row');
    expect(row).toMatch(/min-height:\s*var\(--size-list-row\)/);
    expect(row).toMatch(/gap:\s*var\(--space-2\)/);
    expect(row).toMatch(/align-items:\s*center/);
    expect(row).toMatch(/font-size:\s*var\(--type-body-size\)/);
    expect(rule('.pressable')).toMatch(/background:\s*transparent/);
    expect(rule('.pressable')).toMatch(/text-align:\s*left/);
    expect(rule('.pressable:focus-visible')).toMatch(/outline:\s*2px solid var\(--color-leaf\)/);
    expect(rule('.label')).toMatch(/flex-grow:\s*1/);
    expect(rule('.value')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(rule('.value')).toMatch(/tabular-nums/);
    expect(rule(".value[data-tone='accent']")).toMatch(/color:\s*var\(--color-leaf\)/);
    expect(rule(".value[data-tone='accent']")).toMatch(/font-weight:\s*var\(--type-row-weight\)/);
    expect(rule('.icon')).toMatch(/width:\s*var\(--size-row-icon\)/);
    expect(rule('.icon')).toMatch(/color:\s*var\(--color-ink-muted\)/);
    expect(rule('.gap')).toMatch(/width:\s*var\(--size-row-icon\)/);
  });
});
