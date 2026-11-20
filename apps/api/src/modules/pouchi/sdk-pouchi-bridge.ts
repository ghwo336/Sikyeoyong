import {
  createVerifiedServerWaasClient,
  ServerBridgeError,
  type ServerWaasBridgeClient,
} from '@nc-waas/sdk/server';
import type { PouchiBridge, PouchiBridgeInput, PouchiBridgeOutcome } from './pouchi-bridge.js';

export interface SdkPouchiConfig {
  readonly apiUrl: string;
  readonly tenantId: string;
  readonly appKey: string;
  readonly appId: string;
  readonly bridgeIssuer: string;
  readonly environment: 'sandbox' | 'production';
  readonly chainId: number;
}

/**
 * @nc-waas/sdk/server (beta.8) behind the port. The client checks once that the app key,
 * tenant, environment and chain match (createVerifiedServerWaasClient); a failed check is not
 * kept, so the next login tries again. The expected app id and flow come from the server's own
 * config and pending record, never from the callback body (Pouchi embedded quickstart).
 */
export class SdkPouchiBridge implements PouchiBridge {
  private client: Promise<ServerWaasBridgeClient> | undefined;

  constructor(private readonly config: SdkPouchiConfig) {}

  async complete(input: PouchiBridgeInput): Promise<PouchiBridgeOutcome> {
    const waas = await this.waas();
    let result: Awaited<ReturnType<ServerWaasBridgeClient['completeBridgeResult']>>;
    try {
      result = await waas.completeBridgeResult({
        envelope: input.envelope,
        codeVerifier: input.codeVerifier,
        appId: this.config.appId,
        requestId: input.requestId,
        flow: input.flow,
      });
    } catch (e) {
      // A forged, expired or foreign envelope is a refused login (the SDK throws for these),
      // not a server fault. Anything else (network, client setup) stays an error.
      if (e instanceof ServerBridgeError) return { ok: false, outcome: 'failed', error: e.code };
      throw e;
    }
    if (!result.ok) {
      return { ok: false, outcome: result.claims.outcome, error: result.claims.error };
    }
    return {
      ok: true,
      ownerVerified: result.ownerVerified,
      walletId: result.wallet.walletId,
      walletAddress: result.wallet.walletAddress,
    };
  }

  private waas(): Promise<ServerWaasBridgeClient> {
    if (this.client === undefined) {
      const c = this.config;
      this.client = createVerifiedServerWaasClient({
        apiUrl: c.apiUrl,
        tenantId: c.tenantId,
        appKey: c.appKey,
        bridgeIssuer: c.bridgeIssuer,
        expectedEnvironment: c.environment,
        expectedChainId: c.chainId,
      });
      this.client.catch(() => {
        this.client = undefined;
      });
    }
    return this.client;
  }
}
