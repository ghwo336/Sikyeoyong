import { formatOkrw } from '@sikyeoyong/shared';

/** Main.dc.html header line: "한 번에 10,000원까지" (D-31, no levels). The limit comes from the server. */
export function limitLine(perOrderLimit: bigint): string {
  return `한 번에 ${formatOkrw(perOrderLimit)}까지`;
}
