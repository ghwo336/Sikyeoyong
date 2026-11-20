import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../../config/env.js';

const completeBridgeResult = vi.fn();
const create = vi.fn();
vi.mock('@nc-waas/sdk/server', async (importActual) => {
  const real = await importActual<typeof import('@nc-waas/sdk/server')>();
  return {
    ServerBridgeError: real.ServerBridgeError,
    createVerifiedServerWaasClient: (o: unknown) => create(o) as unknown,
  };
});

type Sdk = typeof import('@nc-waas/sdk/server');
type Bridge = typeof import('./sdk-pouchi-bridge.js');
let ServerBridgeError: Sdk['ServerBridgeError'];
let SdkPouchiBridge: Bridge['SdkPouchiBridge'];
beforeAll(async () => {
  ({ ServerBridgeError } = await vi.importActual<Sdk>('@nc-waas/sdk/server'));
  ({ SdkPouchiBridge } = await import('./sdk-pouchi-bridge.js'));
});

const CONFIG = {
  apiUrl: 'https://pouchi.example',
  tenantId: 't1',
  appKey: 'secret-key',
  appId: 'sikyeoyong',
  bridgeIssuer: 'https://auth.pouchi.io',
  environment: 'sandbox' as const,
  // From the shared chain config (CLAUDE.md 2), never written here.
  chainId: loadConfig({}).chain.chainId,
};
const INPUT = {
  envelope: 'e',
  codeVerifier: 'V'.repeat(43),
  requestId: 'R'.repeat(43),
  flow: 'signup' as const,
};

describe('SdkPouchiBridge', () => {
  it('a forged, expired or foreign envelope (ServerBridgeError) is a failed login, not a crash', async () => {
    create.mockResolvedValue({ completeBridgeResult });
    for (const code of [
      'BRIDGE_ENVELOPE_INVALID',
      'BRIDGE_ENVELOPE_EXPIRED',
      'BRIDGE_ENVELOPE_CONTEXT',
    ] as const) {
      completeBridgeResult.mockRejectedValueOnce(new ServerBridgeError(code));
      expect(await new SdkPouchiBridge(CONFIG).complete(INPUT)).toEqual({
        ok: false,
        outcome: 'failed',
        error: code,
      });
    }
  });

  it('asks with our app id and the bound flow, and maps a success', async () => {
    create.mockResolvedValue({ completeBridgeResult });
    completeBridgeResult.mockResolvedValueOnce({
      ok: true,
      ownerVerified: true,
      claims: {},
      wallet: { walletId: 'w1', walletAddress: '0xabc' },
    });
    expect(await new SdkPouchiBridge(CONFIG).complete(INPUT)).toEqual({
      ok: true,
      ownerVerified: true,
      walletId: 'w1',
      walletAddress: '0xabc',
    });
    expect(completeBridgeResult).toHaveBeenLastCalledWith({
      envelope: 'e',
      codeVerifier: INPUT.codeVerifier,
      appId: 'sikyeoyong',
      requestId: INPUT.requestId,
      flow: 'signup',
    });
  });

  it('other failures stay errors, and a failed client setup is tried again next time', async () => {
    create.mockRejectedValueOnce(new Error('network down'));
    const bridge = new SdkPouchiBridge(CONFIG);
    await expect(bridge.complete(INPUT)).rejects.toThrow('network down');
    create.mockResolvedValue({ completeBridgeResult });
    completeBridgeResult.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(bridge.complete(INPUT)).rejects.toThrow('fetch failed');
    expect(create).toHaveBeenCalledTimes(2);
  });
});
