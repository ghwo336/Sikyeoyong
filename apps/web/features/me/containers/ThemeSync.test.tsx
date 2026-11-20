import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ME } from '../../../lib/mock/fixtures';

const getMe = vi.fn();
vi.mock('../../../lib/api', () => ({ api: { getMe: () => getMe() as unknown } }));

const { ThemeSync } = await import('./ThemeSync');

beforeEach(() => {
  getMe.mockReset();
  localStorage.clear();
  delete document.documentElement.dataset.species;
});

describe('ThemeSync (D-32)', () => {
  it('never asks /me on its own (Start and sign-up pages stay quiet)', () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <ThemeSync />
      </QueryClientProvider>,
    );
    expect(getMe).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.species).toBeUndefined();
  });

  it('paints and remembers the species /me gives, and follows a change', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['me'], { ...ME, dragonSpecies: 'water' });
    render(
      <QueryClientProvider client={qc}>
        <ThemeSync />
      </QueryClientProvider>,
    );
    expect(document.documentElement.dataset.species).toBe('water');
    expect(localStorage.getItem('sikyeoyong.species')).toBe('water');
    act(() => {
      qc.setQueryData(['me'], { ...ME, dragonSpecies: 'star' });
    });
    await waitFor(() => {
      expect(document.documentElement.dataset.species).toBe('star');
    });
  });
});
