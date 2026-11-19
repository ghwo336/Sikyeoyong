import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { okrwToAokrw } from '@sikyeoyong/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  LimitChangeCard,
  type LimitChangeCardProps,
  type LimitChangeStatus,
} from './LimitChangeCard';

const css = readFileSync(resolve(__dirname, 'LimitChangeCard.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? '';
// The buttons are base Button; their sizes live in Button.module.css.
const buttonCss = readFileSync(resolve(__dirname, '../../base/Button/Button.module.css'), 'utf8');
const buttonRule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(buttonCss)?.[2] ??
  '';

const won = (n: bigint) => okrwToAokrw(n);
const base: LimitChangeCardProps = {
  field: 'perOrder',
  from: won(10_000n),
  to: won(50_000n),
  levelFrom: 1,
  levelTo: 3,
  needsReauth: true,
  rows: [{ label: '30일 한도', value: '500,000원 그대로' }],
  onConfirm: () => undefined,
  onCancel: () => undefined,
};

describe('LimitChangeCard (LimitChangeCard.md 테스트 기준)', () => {
  it("says 'Face ID로 확인하고 바꾸기' when reauth is needed, and plain 바꾸기 otherwise", () => {
    const { rerender } = render(<LimitChangeCard {...base} />);
    expect(screen.getByRole('button', { name: 'Face ID로 확인하고 바꾸기' })).toBeInTheDocument();
    rerender(<LimitChangeCard {...base} needsReauth={false} />);
    expect(screen.getByRole('button', { name: '바꾸기' })).toBeInTheDocument();
    expect(screen.queryByText(/Face ID/)).toBeNull();
  });

  it('confirms only through the button: nothing on render, focus or Enter elsewhere', async () => {
    const onConfirm = vi.fn();
    render(<LimitChangeCard {...base} onConfirm={onConfirm} />);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body); // the card does not grab focus
    await userEvent.keyboard('{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /바꾸기$/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm once on a double tap even if the parent never re-renders (ref lock)', () => {
    const onConfirm = vi.fn();
    render(<LimitChangeCard {...base} onConfirm={onConfirm} />);
    const button = screen.getByRole('button', { name: /바꾸기$/ });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not call onConfirm when drawn already confirming', () => {
    const onConfirm = vi.fn();
    render(<LimitChangeCard {...base} onConfirm={onConfirm} status="confirming" />);
    const button = screen.getByRole('button', { name: /바꾸기$/ });
    expect(button).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm once on a fast double tap, and again after a failure', () => {
    const onConfirm = vi.fn();
    function Parent() {
      const [status, setStatus] = useState<LimitChangeStatus>('idle');
      return (
        <>
          <LimitChangeCard
            {...base}
            status={status}
            onConfirm={() => {
              onConfirm();
              setStatus('confirming');
            }}
          />
          <button
            type="button"
            onClick={() => {
              setStatus('failed');
            }}
          >
            실패
          </button>
        </>
      );
    }
    render(<Parent />);
    const button = () => screen.getByRole('button', { name: /바꾸기$/ });
    fireEvent.click(button());
    fireEvent.click(button());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(button()).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(screen.getByText('실패'));
    expect(screen.getByRole('alert')).toHaveTextContent('못 바꿨어요. 다시 해 볼까요?');
    fireEvent.click(button());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('cancels with 그만두기', async () => {
    const onCancel = vi.fn();
    render(<LimitChangeCard {...base} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: '그만두기' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows before and after with formatOkrw, read as "A에서 B으로"', () => {
    render(<LimitChangeCard {...base} />);
    const region = screen.getByRole('region', { name: '한도 바꾸기' });
    expect(region).toHaveTextContent('한 번에 쓸 수 있는 돈10,000원에서50,000원으로');
    expect(screen.getByText('10,000원').tagName).toBe('S');
  });

  it('shows amounts past Number exactly', () => {
    render(<LimitChangeCard {...base} to={won(123_456_789_012_345_678n)} />);
    expect(screen.getByText('123,456,789,012,345,678원')).toBeInTheDocument();
  });

  it('names the field: per order or the month budget', () => {
    const { rerender } = render(<LimitChangeCard {...base} />);
    expect(screen.getByText('한 번에 쓸 수 있는 돈')).toBeInTheDocument();
    rerender(
      <LimitChangeCard {...base} field="monthlyBudget" levelFrom={undefined} levelTo={undefined} />,
    );
    expect(screen.getByText('이번 달 배달 예산')).toBeInTheDocument();
  });

  it('shows the level line only when the level changes, with the right particle', () => {
    const { rerender } = render(<LimitChangeCard {...base} />);
    expect(screen.getByText('1에서 3으로')).toBeInTheDocument();
    rerender(<LimitChangeCard {...base} levelFrom={3} levelTo={2} />);
    expect(screen.getByText('3에서 2로')).toBeInTheDocument();
    rerender(<LimitChangeCard {...base} levelFrom={2} levelTo={2} />);
    expect(screen.queryByText('레벨')).toBeNull();
    rerender(<LimitChangeCard {...base} levelFrom={undefined} levelTo={undefined} />);
    expect(screen.queryByText('레벨')).toBeNull();
  });

  it('shows the extra rows as given', () => {
    render(<LimitChangeCard {...base} />);
    expect(screen.getByText('30일 한도').nextSibling).toHaveTextContent('500,000원 그대로');
  });

  // LimitChat.dc.html 36-50.
  it('matches the design values', () => {
    const card = rule('.card');
    expect(card).toMatch(/border:\s*2px solid var\(--color-leaf\)/);
    expect(card).toMatch(/border-radius:\s*var\(--radius-card\)/);
    expect(card).toMatch(/padding:\s*var\(--space-4\)/);
    expect(card).toMatch(/gap:\s*var\(--size-limits-gap\)/);
    expect(rule('.title')).toMatch(/color:\s*var\(--color-leaf\)/);
    expect(rule('.from')).toMatch(/color:\s*var\(--color-ink-muted\)/);
    expect(rule('.to')).toMatch(/font-size:\s*var\(--type-change-to-size\)/);
    expect(rule('.row')).toMatch(/font-size:\s*var\(--type-small-size\)/);
    // Confirm: Button primary choice (52, radius 16, 16/700). Cancel: Button text md (44, 15/400).
    render(<LimitChangeCard {...base} />);
    const confirm = screen.getByRole('button', { name: /바꾸기$/ });
    expect([...confirm.classList]).toEqual(expect.arrayContaining(['primary', 'choice']));
    const cancel = screen.getByRole('button', { name: '그만두기' });
    expect([...cancel.classList]).toEqual(expect.arrayContaining(['text', 'md']));
    expect(buttonRule('.choice')).toMatch(/min-height:\s*var\(--size-choice-button\)/);
    const primaryChoice = buttonRule('.primary.choice');
    expect(primaryChoice).toMatch(/border-radius:\s*var\(--radius-card-button\)/);
    expect(primaryChoice).toMatch(/font-size:\s*var\(--type-row-size\)/);
    expect(primaryChoice).toMatch(/font-weight:\s*var\(--type-button-weight\)/);
    expect(buttonRule('.md')).toMatch(/min-height:\s*var\(--size-touch-min\)/);
    expect(buttonRule('.text')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    expect(buttonRule('.text.md')).toMatch(/font-weight:\s*var\(--type-body-weight\)/);
    expect(rule('.actions')).toMatch(/gap:\s*6px/);
    expect(rule('.faceId')).toMatch(/width:\s*var\(--size-face-id-icon\)/);
  });
});
