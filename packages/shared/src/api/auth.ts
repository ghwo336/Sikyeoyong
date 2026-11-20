import { z } from 'zod';

/**
 * D-29 Pouchi login (the only login): the public config the web needs to open the vault.
 * GET /auth/pouchi/config. No key here; the app key stays on the server.
 */
export const zPouchiLoginConfig = z
  .object({ vaultUrl: z.url(), appId: z.string().min(1).max(64), callbackUrl: z.url() })
  .strict();
export type PouchiLoginConfig = z.infer<typeof zPouchiLoginConfig>;

const requestId = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._:-]+$/);

/** POST /auth/pouchi/bind: before the vault opens, the server records this request (PKCE challenge). */
export const zPouchiBindBody = z
  .object({
    requestId,
    codeChallenge: z.string().min(1).max(200),
    flow: z.enum(['signup', 'login']),
  })
  .strict();
export type PouchiBindBody = z.infer<typeof zPouchiBindBody>;

/** POST /auth/pouchi/complete: the vault's signed result for a bound request; redeemed once. */
export const zPouchiCompleteBody = z
  .object({
    envelope: z.string().min(1).max(16_384),
    codeVerifier: z.string().min(43).max(128),
    requestId,
    state: z.string().max(512).optional(),
  })
  .strict();
export type PouchiCompleteBody = z.infer<typeof zPouchiCompleteBody>;
