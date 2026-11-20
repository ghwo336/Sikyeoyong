import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AmountStepper, type AmountStepperProps } from './AmountStepper';

const css = readFileSync(resolve(__dirname, 'AmountStepper.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';
const buttonCss = readFileSync(resolve(__dirname, '../../base/Button/Button.module.css'), 'utf8');

const won = (n: bigint) => okrwToAokrw(n);
const base: AmountStepperProps = {
  label: '한 번에 쓸 돈',
  value: won(10_000n),
  min: won(5_000n),
  max: won(50_000n),
  step: won(5_000n),
  onChange: () => undefined,
};
const less = () => screen.getByRole('button', { name: '한 번에 쓸 돈 5,000원 내리기' });
const more = () => screen.getByRole('button', { name: '한 번에 쓸 돈 5,000원 올리기' });

describe('AmountStepper (AmountStepper.md 테스트 기준)', () => {
  it('is a group named by its label, with the amount between − and +', () => {
    render(<AmountStepper {...base} />);
    const group = screen.getByRole('group', { name: '한 번에 쓸 돈' });
    const kids = Array.from(group.children);
    expect(kids.map((k) => k.tagName)).toEqual(['BUTTON', 'OUTPUT', 'BUTTON']);
    expect(kids[0]).toHaveTextContent('−');
    expect(kids[2]).toHaveTextContent('+');
  });

  it('announces the amount politely, read as formatOkrw', () => {
    render(<AmountStepper {...base} />);
    const output = screen.getByRole('status');
    expect(output).toHaveAttribute('aria-live', 'polite');
    expect(output).toContainElement(screen.getByText('10,000원'));
  });

  it('moves by one step and calls onChange with a bigint', async () => {
    const onChange = vi.fn();
    render(<AmountStepper {...base} onChange={onChange} />);
    await userEvent.click(more());
    expect(onChange).toHaveBeenLastCalledWith(won(15_000n));
    await userEvent.click(less());
    expect(onChange).toHaveBeenLastCalledWith(won(5_000n));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('works from the keyboard', async () => {
    const onChange = vi.fn();
    render(<AmountStepper {...base} onChange={onChange} />);
    more().focus();
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(won(15_000n));
  });

  it('fades and stops − at min and + at max, keeping focus', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AmountStepper {...base} value={won(5_000n)} onChange={onChange} />,
    );
    expect(less()).toHaveAttribute('aria-disabled', 'true');
    expect(more()).not.toHaveAttribute('aria-disabled');
    less().focus();
    await userEvent.keyboard('{Enter}');
    expect(less()).toHaveFocus();
    rerender(<AmountStepper {...base} value={won(50_000n)} onChange={onChange} />);
    expect(more()).toHaveAttribute('aria-disabled', 'true');
    expect(less()).not.toHaveAttribute('aria-disabled');
    await userEvent.click(more());
    expect(onChange).not.toHaveBeenCalled();
  });

  it('never goes past min or max, even from an off-step value', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <AmountStepper {...base} value={won(47_000n)} onChange={onChange} />,
    );
    await userEvent.click(more());
    expect(onChange).toHaveBeenLastCalledWith(won(50_000n));
    rerender(<AmountStepper {...base} value={won(7_000n)} onChange={onChange} />);
    await userEvent.click(less());
    expect(onChange).toHaveBeenLastCalledWith(won(5_000n));
  });

  it('shows amounts past Number exactly and names the step in the button', () => {
    const big = won(123_456_789_012_345_678n);
    render(
      <AmountStepper
        label="30일에 쓸 돈"
        value={big}
        min={won(50_000n)}
        max={big}
        step={won(50_000n)}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByText('123,456,789,012,345,678원')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '30일에 쓸 돈 50,000원 올리기' }),
    ).toBeInTheDocument();
  });

  it('rolls the digits (base Amount animate)', () => {
    const { container } = render(<AmountStepper {...base} />);
    expect(container.querySelector('output [aria-hidden="true"]')).not.toBeNull();
  });

  // Budget.dc.html 32-40.
  it('matches the design values', () => {
    expect(rule('.stepper')).toMatch(/gap:\s*var\(--size-summary-gap\)/);
    expect(rule('.title')).toMatch(/font-size:\s*var\(--type-body-size\)/);
    expect(rule('.title')).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
    const box = rule('.box');
    expect(box).toMatch(/height:\s*var\(--size-pick-row\)/);
    expect(box).toMatch(/padding:\s*0 var\(--space-2\)/);
    expect(box).toMatch(/gap:\s*var\(--space-3\)/);
    expect(box).toMatch(/border:\s*1px solid var\(--color-line\)/);
    expect(box).toMatch(/border-radius:\s*var\(--radius-button\)/);
    expect(box).toMatch(/background:\s*var\(--color-surface\)/);
    expect(rule('.value')).toMatch(/font-size:\s*var\(--type-pay-size\)/);
    expect(rule('.value')).toMatch(/font-weight:\s*var\(--type-pay-weight\)/);
    expect(rule('.value')).toMatch(/font-variant-numeric:\s*tabular-nums/);
    // The buttons are base Button soft round (48 circle); their values live in Button.module.css.
    render(<AmountStepper {...base} />);
    expect([...less().classList]).toEqual(expect.arrayContaining(['soft', 'round']));
    expect(buttonCss).toMatch(/\.round\s*\{[^}]*width:\s*var\(--size-button-secondary\)/);
    expect(buttonCss).toMatch(/\.button\[aria-disabled='true'\]\s*\{[^}]*opacity:\s*0\.35/);
  });
});
