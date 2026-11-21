// Pouchi login vault defaults, in one place: the API (env.ts) and the web CSP (apps/web) use them.
// Both are public origins, not secrets.
export const DEFAULT_POUCHI_VAULT_URL = 'https://auth.pouchi.io';
export const DEFAULT_POUCHI_BRIDGE_ISSUER = 'https://auth.pouchi.io';
