/**
 * How "이메일로 시작하기" logs in (D-29): the Pouchi vault only against the real API with no dev
 * key; otherwise the direct login (the mock's, or the API dev login with the key).
 */
export function loginKindFor(
  apiMode: string | undefined,
  devLoginKey: string | undefined,
): 'vault' | 'direct' {
  return apiMode === 'http' && devLoginKey === undefined ? 'vault' : 'direct';
}
