import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useSubmitLock } from './useSubmitLock';

function Probe({ busy, onSubmit }: { busy: boolean; onSubmit: () => void }) {
  const submit = useSubmitLock(busy, onSubmit);
  return (
    <button type="button" onClick={submit}>
      보내기
    </button>
  );
}

describe('useSubmitLock (useSubmitLock.md 테스트 기준)', () => {
  it('calls once on a double tap even if the parent never re-renders', () => {
    const onSubmit = vi.fn();
    render(<Probe busy={false} onSubmit={onSubmit} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not call while busy', () => {
    const onSubmit = vi.fn();
    render(<Probe busy onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('opens again after busy goes up and then down (retry after a failure)', () => {
    const onSubmit = vi.fn();
    function Parent() {
      const [busy, setBusy] = useState(false);
      return (
        <>
          <Probe
            busy={busy}
            onSubmit={() => {
              onSubmit();
              setBusy(true);
            }}
          />
          <button
            type="button"
            onClick={() => {
              setBusy(false);
            }}
          >
            실패
          </button>
        </>
      );
    }
    render(<Parent />);
    const button = screen.getByRole('button', { name: '보내기' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('실패'));
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('unlocks only on a render that is not busy', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(<Probe busy={false} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button'));
    rerender(<Probe busy onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    rerender(<Probe busy={false} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
