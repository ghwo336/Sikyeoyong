import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: () => notFound() }));
vi.mock('../me/containers/EntryGate', () => ({
  EntryGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('./containers/LeakCompareContainer', () => ({
  LeakCompareContainer: () => <p>leak compare</p>,
}));

const { default: LeakComparePage } = await import('../../app/demo/leak/page');

afterEach(() => {
  vi.unstubAllEnvs();
  notFound.mockClear();
});

describe('/demo/leak page', () => {
  it('is a 404 when the build is not a demo build', () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'false');
    expect(() => render(<LeakComparePage />)).toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled(); // React retries a throwing render, so not exactly once
  });

  it('is a 404 when the flag is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', '');
    expect(() => render(<LeakComparePage />)).toThrow('NEXT_NOT_FOUND');
  });

  it('assembles the comparison behind the entry gate in a demo build', () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true');
    render(<LeakComparePage />);
    expect(screen.getByText('leak compare')).toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });
});
