// The one session entry (D-29): every login goes through here, so when Pouchi's vault gains
// Kakao only this file and the first button change. Two ways in:
// - vault: the Pouchi vault (email code, passkey, a wallet on sign-up) against the real API.
//   The SDK is loaded only in the browser, only here.
// - direct: the mock's login, or the API dev login with a NEXT_PUBLIC_DEV_LOGIN_KEY.
import { api, loginKind } from '../api';
import type { ApiClient } from '../api/types';

interface BridgeResult {
  readonly envelope: string;
  readonly codeVerifier: string;
  readonly requestId: string;
}

// Exactly these three go back (the Pouchi BFF example); the result's state stays in the browser.
const complete = (client: ApiClient, r: BridgeResult) =>
  client.pouchiComplete({
    requestId: r.requestId,
    envelope: r.envelope,
    codeVerifier: r.codeVerifier,
  });

/** "이메일로 시작하기": open the vault and turn its result into a session. */
export async function startSession(
  client: ApiClient = api,
  kind: 'vault' | 'direct' = loginKind,
): Promise<void> {
  if (kind === 'direct') return client.login();
  const config = await client.getPouchiLoginConfig();
  const { pouchiEmbedded } = await import('@nc-waas/sdk/browser');
  const result = await pouchiEmbedded.login({
    vaultUrl: config.vaultUrl,
    appId: config.appId,
    callbackUrl: config.callbackUrl,
    // The server records the request before the vault opens; the result is redeemed once.
    beforeOpen: (request) =>
      client.pouchiBind({
        requestId: request.requestId,
        codeChallenge: request.codeChallenge,
        // A login opens the sign-up flow (sign-in or sign-up, the vault decides).
        flow: 'signup',
      }),
  });
  await complete(client, result);
}

/**
 * The vault came back to /pouchi/callback in the same tab (Safari passkey): finish the same
 * request. true when there was a result and the session is set; false when there was nothing.
 */
export async function resumeSession(client: ApiClient = api): Promise<boolean> {
  const { pouchiBridge } = await import('@nc-waas/sdk/browser');
  const returned = await pouchiBridge.handleCallback();
  if (returned === null) return false;
  await complete(client, returned);
  return true;
}
