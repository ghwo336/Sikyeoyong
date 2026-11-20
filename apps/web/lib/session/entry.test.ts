import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../api/types';

const login = vi.fn();
const handleCallback = vi.fn();
vi.mock('@nc-waas/sdk/browser', () => ({
  pouchiEmbedded: { login: (o: unknown) => login(o) as unknown },
  pouchiBridge: { handleCallback: () => handleCallback() as unknown },
}));
// lib/api is imported by entry.ts for its defaults; these tests always pass a client.
vi.mock('../api', () => ({ api: {}, loginKind: 'direct' }));

const { resumeSession, startSession } = await import('./entry');

const CONFIG = {
  vaultUrl: 'https://auth.pouchi.io',
  appId: 'sikyeoyong',
  callbackUrl: 'http://localhost:3000/pouchi/callback',
};
const RESULT = { envelope: 'e', codeVerifier: 'v'.repeat(43), requestId: 'r1', state: 's' };

function client() {
  return {
    login: vi.fn(() => Promise.resolve()),
    getPouchiLoginConfig: vi.fn(() => Promise.resolve(CONFIG)),
    pouchiBind: vi.fn(() => Promise.resolve()),
    pouchiComplete: vi.fn(() => Promise.resolve()),
  };
}
const asApi = (c: ReturnType<typeof client>) => c as unknown as ApiClient;

describe('the session entry (D-29)', () => {
  it('direct: the mock or dev login, no vault', async () => {
    const c = client();
    await startSession(asApi(c), 'direct');
    expect(c.login).toHaveBeenCalledTimes(1);
    expect(login).not.toHaveBeenCalled();
  });

  it('vault: opens the vault with the server config, binds before it opens, redeems the result', async () => {
    const c = client();
    login.mockImplementationOnce(
      async (o: { beforeOpen: (r: object) => Promise<void> } & Record<string, unknown>) => {
        await o.beforeOpen({ requestId: 'r1', codeChallenge: 'ch', flow: 'signup' });
        return RESULT;
      },
    );
    await startSession(asApi(c), 'vault');
    expect(login).toHaveBeenCalledWith(expect.objectContaining(CONFIG));
    expect(c.pouchiBind).toHaveBeenCalledWith({
      requestId: 'r1',
      codeChallenge: 'ch',
      flow: 'signup',
    });
    expect(c.pouchiComplete).toHaveBeenCalledWith(RESULT);
    expect(c.login).not.toHaveBeenCalled();
    // bind came before complete
    expect(c.pouchiBind.mock.invocationCallOrder[0]).toBeLessThan(
      c.pouchiComplete.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('a cancelled vault rejects and nothing is redeemed', async () => {
    const c = client();
    login.mockRejectedValueOnce(new Error('cancelled'));
    await expect(startSession(asApi(c), 'vault')).rejects.toThrow('cancelled');
    expect(c.pouchiComplete).not.toHaveBeenCalled();
  });

  it('the callback page finishes a returned result once, and does nothing without one', async () => {
    const c = client();
    handleCallback.mockResolvedValueOnce(RESULT);
    expect(await resumeSession(asApi(c))).toBe(true);
    expect(c.pouchiComplete).toHaveBeenCalledWith(RESULT);
    handleCallback.mockResolvedValueOnce(null);
    expect(await resumeSession(asApi(c))).toBe(false);
    expect(c.pouchiComplete).toHaveBeenCalledTimes(1);
  });
});
