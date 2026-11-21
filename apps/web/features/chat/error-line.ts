import { AppError, APP_ERRORS, renderDragonLine } from '@sikyeoyong/shared';

/**
 * What the dragon says when the API refused something the owner tapped in the chat (an old
 * recommendation: 422 CHAIN_MERCHANT_INACTIVE). The server's own line wins (it has the values:
 * the limit, the date). Without one the shared table's line is used; a line that needs values
 * the screen does not have falls back to the plain message, and anything that is not an API
 * refusal (a dropped connection) gets the generic line. Never a silent tap.
 */
export function dragonLineOf(err: unknown): string {
  if (!(err instanceof AppError)) return renderDragonLine('INTERNAL');
  const detail: unknown = err.detail;
  if (typeof detail === 'object' && detail !== null && 'dragonLine' in detail) {
    const line = detail.dragonLine;
    if (typeof line === 'string' && line.trim() !== '') return line;
  }
  try {
    return renderDragonLine(err.code);
  } catch {
    return APP_ERRORS[err.code].message;
  }
}
