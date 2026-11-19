import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Chip } from '../Chip';
import { ChoiceGroup, type ChoiceGroupProps } from './ChoiceGroup';

const css = readFileSync(resolve(__dirname, 'ChoiceGroup.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';

const OPTIONS = ['또 먹을래', '괜찮았어', '별로였어'] as const;
type Opt = (typeof OPTIONS)[number];

function props(over: Partial<ChoiceGroupProps<Opt>> = {}): ChoiceGroupProps<Opt> {
  return {
    options: OPTIONS,
    value: undefined,
    onChange: () => undefined,
    keyOf: (o) => o,
    layout: 'columns',
    title: '오늘 돼지국밥 어땠어요?',
    renderOption: (o, s) => (
      <Chip size="tile" selected={s.selected} tabIndex={s.tabIndex} onPress={s.select}>
        {o}
      </Chip>
    ),
    ...over,
  };
}

function Controlled({ onChange }: { onChange: (v: Opt) => void }) {
  const [value, setValue] = useState<Opt | undefined>(undefined);
  return (
    <ChoiceGroup
      {...props({
        value,
        onChange: (v) => {
          onChange(v);
          setValue(v);
        },
      })}
    />
  );
}

describe('ChoiceGroup (ChoiceGroup.md 테스트 기준)', () => {
  it('is a radio group named by its visible title', () => {
    render(<ChoiceGroup {...props()} />);
    const group = screen.getByRole('radiogroup', { name: '오늘 돼지국밥 어땠어요?' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('uses label as the name when there is no title, and draws no title', () => {
    const { container } = render(<ChoiceGroup {...props({ title: undefined, label: '알' })} />);
    expect(screen.getByRole('radiogroup', { name: '알' })).toBeInTheDocument();
    expect(container.querySelector('p')).toBeNull();
  });

  it('marks only the picked option checked', () => {
    render(<ChoiceGroup {...props({ value: '괜찮았어' })} />);
    const checked = screen
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked.map((r) => r.textContent)).toEqual(['괜찮았어']);
  });

  it('calls onChange once per press with the option', async () => {
    const onChange = vi.fn();
    render(<ChoiceGroup {...props({ onChange })} />);
    await userEvent.click(screen.getByRole('radio', { name: '별로였어' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('별로였어');
  });

  it('enters once with Tab, on the picked one or the first', () => {
    const { rerender } = render(<ChoiceGroup {...props()} />);
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    rerender(<ChoiceGroup {...props({ value: '별로였어' })} />);
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([-1, -1, 0]);
  });

  it('moves and picks with arrow keys, wrapping around', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('별로였어');
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('또 먹을래');
    expect(screen.getByRole('radio', { name: '또 먹을래' })).toHaveFocus();
  });

  it('puts each option straight in the layout (no wrapper), with the layout class', () => {
    const { rerender } = render(<ChoiceGroup {...props()} />);
    const group = screen.getByRole('radiogroup');
    expect(group.classList).toContain('columns');
    expect(Array.from(group.children).every((c) => c.getAttribute('role') === 'radio')).toBe(true);
    rerender(<ChoiceGroup {...props({ layout: 'row' })} />);
    expect(screen.getByRole('radiogroup').classList).toContain('row');
  });

  // Budget.dc.html, Arrived.dc.html (columns) and Name.dc.html (row).
  it('matches the design values', () => {
    expect(rule('.group')).toMatch(/gap:\s*var\(--size-summary-gap\)/);
    expect(rule('.title')).toMatch(/font-size:\s*var\(--type-body-size\)/);
    expect(rule('.title')).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
    expect(rule('.columns')).toMatch(/grid-auto-columns:\s*minmax\(0, 1fr\)/);
    expect(rule('.columns')).toMatch(/grid-auto-flow:\s*column/);
    expect(rule('.columns')).toMatch(/gap:\s*var\(--space-2\)/);
    expect(rule('.row')).toMatch(/gap:\s*var\(--size-summary-gap\)/);
  });
});
