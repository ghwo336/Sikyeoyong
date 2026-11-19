import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TextField } from './TextField';

const css = readFileSync(resolve(__dirname, 'TextField.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.[\]:]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

function Controlled({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <TextField
      label="이름"
      value={value}
      maxLength={8}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe('TextField (TextField.md 테스트 기준)', () => {
  it('ties the label to the input with htmlFor', () => {
    render(<TextField label="이름" value="용이" onChange={vi.fn()} />);
    const input = screen.getByLabelText('이름');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveValue('용이');
    const label = screen.getByText('이름');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('for', input.id);
  });

  it('gives two fields different ids', () => {
    render(
      <>
        <TextField label="이름" value="" onChange={vi.fn()} />
        <TextField label="별명" value="" onChange={vi.fn()} />
      </>,
    );
    expect(screen.getByLabelText('이름').id).not.toBe(screen.getByLabelText('별명').id);
  });

  it('sets aria-invalid and reads the error when there is one', () => {
    render(<TextField label="이름" value="" error="이름을 지어 주세요" onChange={vi.fn()} />);
    const input = screen.getByLabelText('이름');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('이름을 지어 주세요');
    expect(input).toHaveAttribute('data-error');
    // Shown after the button press, so it is announced (user-flow.md step 3).
    expect(screen.getByRole('alert')).toHaveTextContent('이름을 지어 주세요');
  });

  it.each([undefined, ''])('has no aria-invalid and no message when error is %j', (error) => {
    const { container } = render(
      <TextField label="이름" value="" error={error} onChange={vi.fn()} />,
    );
    const input = screen.getByLabelText('이름');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(input).not.toHaveAttribute('data-error');
    expect(container.querySelector('p')).toBeNull();
  });

  it('hands every typed value to the parent and keeps the 8 character cap', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByLabelText('이름');
    await userEvent.type(input, '용이');
    expect(onChange).toHaveBeenLastCalledWith('용이');
    expect(input).toHaveAttribute('maxlength', '8');
  });

  it('passes inputMode and placeholder through', () => {
    render(
      <TextField label="금액" value="" inputMode="numeric" placeholder="0" onChange={vi.fn()} />,
    );
    const input = screen.getByLabelText('금액');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('placeholder', '0');
  });

  // Name.dc.html lines 50-52.
  it('matches the Name design values', () => {
    expect(rule('.field')).toMatch(/gap:\s*6px/);
    expect(rule('.label')).toMatch(/font-size:\s*var\(--type-label-size\)/);
    expect(rule('.label')).toMatch(/font-weight:\s*var\(--type-label-weight\)/);
    expect(rule('.label')).toMatch(/color:\s*var\(--color-ink-secondary\)/);
    const input = rule('.input');
    expect(input).toMatch(/height:\s*var\(--size-input\)/);
    expect(input).toMatch(/padding:\s*0 var\(--space-4\)/);
    expect(input).toMatch(/border:\s*1px solid var\(--color-line-strong\)/);
    expect(input).toMatch(/border-radius:\s*var\(--radius-input\)/);
    expect(input).toMatch(/background:\s*var\(--color-surface\)/);
    expect(input).toMatch(/font-size:\s*var\(--type-input-size\)/);
    expect(input).toMatch(/font-weight:\s*var\(--type-input-weight\)/);
    expect(input).toMatch(/color:\s*var\(--color-ink\)/);
    expect(rule('.input:focus-visible')).toMatch(/outline:\s*2px solid var\(--color-leaf\)/);
    expect(rule('.input[data-error]')).toMatch(/border-color:\s*var\(--color-over\)/);
    expect(rule('.error')).toMatch(/color:\s*var\(--color-over-ink\)/);
  });
});
