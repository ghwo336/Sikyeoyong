import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatInput } from './ChatInput';

const css = readFileSync(resolve(__dirname, 'ChatInput.module.css'), 'utf8');
const rule = (selector: string) =>
  new RegExp(`(^|\\n)${selector.replace(/[.:]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(
    css,
  )?.[2] ?? '';

function Live({
  onSend,
  sending,
  disabled,
}: {
  onSend: (t: string) => void;
  sending?: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  return (
    <ChatInput
      value={value}
      onChange={setValue}
      onSend={onSend}
      placeholder="오늘 저녁도 부탁해"
      sending={sending}
      disabled={disabled}
      disabledNote="용이가 멈춰 있어요"
    />
  );
}

const field = () => screen.getByRole('textbox', { name: '용이에게 말하기' });
const sendButton = () => screen.getByRole('button', { name: '보내기' });

describe('ChatInput (ChatInput.md 테스트 기준)', () => {
  it('does not call onSend for an empty or blank value', async () => {
    const onSend = vi.fn();
    render(<Live onSend={onSend} />);
    await userEvent.click(sendButton());
    await userEvent.type(field(), '   {Enter}');
    await userEvent.click(sendButton());
    expect(onSend).not.toHaveBeenCalled();
    expect(sendButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('sends with Enter, trimmed, once', async () => {
    const onSend = vi.fn();
    render(<Live onSend={onSend} />);
    await userEvent.type(field(), '  점심 시켜 줘 {Enter}');
    expect(onSend).toHaveBeenCalledExactlyOnceWith('점심 시켜 줘');
  });

  it('never lets the form submit itself (no page reload), whatever the state', () => {
    const onSend = vi.fn();
    const { container, rerender } = render(
      <ChatInput value="국밥" onChange={vi.fn()} onSend={onSend} placeholder="" />,
    );
    const form = () => container.querySelector('form') as HTMLFormElement;
    // false = default prevented
    expect(fireEvent.submit(form())).toBe(false);
    expect(onSend).toHaveBeenCalledExactlyOnceWith('국밥');
    rerender(<ChatInput value="" onChange={vi.fn()} onSend={onSend} placeholder="" />);
    expect(fireEvent.submit(form())).toBe(false);
    rerender(<ChatInput value="국밥" onChange={vi.fn()} onSend={onSend} placeholder="" sending />);
    expect(fireEvent.submit(form())).toBe(false);
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('sends with the button too', async () => {
    const onSend = vi.fn();
    render(<Live onSend={onSend} />);
    await userEvent.type(field(), '국밥');
    expect(sendButton()).not.toHaveAttribute('aria-disabled');
    await userEvent.click(sendButton());
    expect(onSend).toHaveBeenCalledExactlyOnceWith('국밥');
  });

  it('does not send on the Enter that ends a Korean composition', async () => {
    const onSend = vi.fn();
    render(<ChatInput value="국밥" onChange={vi.fn()} onSend={onSend} placeholder="" />);
    // false = default prevented, so the form is not submitted
    expect(fireEvent.keyDown(field(), { key: 'Enter', isComposing: true })).toBe(false);
    fireEvent.compositionStart(field());
    expect(fireEvent.keyDown(field(), { key: 'Enter' })).toBe(false);
    // Safari: compositionend first, then the Enter in the same tick
    fireEvent.compositionEnd(field());
    expect(fireEvent.keyDown(field(), { key: 'Enter' })).toBe(false);
    expect(onSend).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 5));
    expect(fireEvent.keyDown(field(), { key: 'Enter' })).toBe(true);
  });

  it('lets you type but not send again while sending', async () => {
    const onSend = vi.fn();
    render(<Live onSend={onSend} sending />);
    await userEvent.type(field(), '하나 더{Enter}');
    expect(field()).toHaveValue('하나 더');
    await userEvent.click(sendButton());
    expect(onSend).not.toHaveBeenCalled();
    expect(sendButton()).toHaveAttribute('aria-busy', 'true');
  });

  it('is fully off when stopped, with the note read from the field', async () => {
    const onSend = vi.fn();
    render(<Live onSend={onSend} disabled />);
    expect(field()).toBeDisabled();
    expect(sendButton()).toBeDisabled();
    expect(field()).toHaveAccessibleDescription('용이가 멈춰 있어요');
    await userEvent.click(sendButton());
    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows no note while not disabled', () => {
    render(
      <ChatInput
        value=""
        onChange={vi.fn()}
        onSend={vi.fn()}
        placeholder=""
        disabledNote="용이가 멈춰 있어요"
      />,
    );
    expect(screen.queryByText('용이가 멈춰 있어요')).toBeNull();
    expect(field()).not.toHaveAttribute('aria-describedby');
  });

  it('hands every keystroke to onChange', async () => {
    const onChange = vi.fn();
    render(<ChatInput value="" onChange={onChange} onSend={vi.fn()} placeholder="" />);
    await userEvent.type(field(), '용');
    expect(onChange).toHaveBeenLastCalledWith('용');
  });

  it('draws the design arrow', () => {
    const { container } = render(
      <ChatInput value="" onChange={vi.fn()} onSend={vi.fn()} placeholder="" />,
    );
    const paths = Array.from(container.querySelectorAll('svg path')).map((p) =>
      p.getAttribute('d'),
    );
    expect(paths).toEqual(['M12 19V5', 'M6 11l6-6 6 6']);
    expect(container.querySelector('svg')).toHaveAttribute('stroke-width', '2.2');
  });

  // Main.dc.html 84-87.
  it('matches the design values', () => {
    const input = rule('.input');
    expect(input).toMatch(/height:\s*var\(--size-chat-input\)/);
    expect(input).toMatch(/padding:\s*0 var\(--size-chat-input-pad-x\)/);
    expect(input).toMatch(/border:\s*1px solid var\(--color-line-strong\)/);
    expect(input).toMatch(/border-radius:\s*calc\(var\(--size-chat-input\) \/ 2\)/);
    expect(input).toMatch(/background:\s*var\(--color-surface\)/);
    expect(input).toMatch(/font-size:\s*var\(--type-body-size\)/);
    const send = rule('.send');
    expect(send).toMatch(/width:\s*var\(--size-chat-input\)/);
    expect(send).toMatch(/background:\s*var\(--color-leaf\)/);
    expect(send).toMatch(/color:\s*var\(--color-surface\)/);
    expect(rule('.icon')).toMatch(/width:\s*var\(--size-send-icon\)/);
    expect(rule('.row')).toMatch(/gap:\s*var\(--space-2\)/);
    expect(rule('.send:disabled')).toMatch(/background:\s*var\(--color-line-strong\)/);
    expect(rule('.input:focus-visible')).toMatch(/outline:\s*2px solid var\(--color-leaf\)/);
    expect(rule('.send:focus-visible')).toMatch(/outline:\s*2px solid var\(--color-leaf\)/);
  });
});
