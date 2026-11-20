import { z } from 'zod';

/**
 * D-29 Pouchi login (the only login): the public config the web needs to open the vault.
 * GET /auth/pouchi/config. No key here; the app key stays on the server.
 */
export const zPouchiLoginConfig = z
  .object({ vaultUrl: z.url(), appId: z.string().min(1).max(64), callbackUrl: z.url() })
  .strict();
export type PouchiLoginConfig = z.infer<typeof zPouchiLoginConfig>;

/**
 * Request ids, PKCE challenges and verifiers are 43 base64url characters (32 random bytes),
 * exactly as the Pouchi BFF example checks them (pouchi.io llms-full "최소 BFF 로그인").
 */
const token43 = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** POST /auth/pouchi/bind: before the vault opens, the server records this request and its challenge. */
export const zPouchiBindBody = z
  .object({ requestId: token43, codeChallenge: token43, flow: z.literal('signup') })
  .strict();
export type PouchiBindBody = z.infer<typeof zPouchiBindBody>;

/** POST /auth/pouchi/complete: the vault's signed result for a bound request; redeemed once. */
export const zPouchiCompleteBody = z
  .object({
    requestId: token43,
    envelope: z.string().min(1).max(16_384),
    codeVerifier: token43,
  })
  .strict();
export type PouchiCompleteBody = z.infer<typeof zPouchiCompleteBody>;

/** GET /identity: whether the session owner passed the identity check (D-16). The front door uses it. */
export const zIdentityStatus = z.object({ verified: z.boolean() }).strict();
export type IdentityStatus = z.infer<typeof zIdentityStatus>;
