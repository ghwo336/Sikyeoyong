import { createVerifiedServerWaasClient, type ServerWaasBridgeClient } from '@nc-waas/sdk/server';
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
    const result = await (
      await this.waas()
    ).completeBridgeResult({
      envelope: input.envelope,
      codeVerifier: input.codeVerifier,
      appId: this.config.appId,
      requestId: input.requestId,
      flow: input.flow,
    });
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
