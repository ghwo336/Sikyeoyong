import { formatOkrw } from '@sikyeoyong/shared';

/** Main.dc.html header line: "레벨 1, 한 번에 10,000원까지". The limit comes from the server. */
export function levelLine(level: number, perOrderLimit: bigint): string {
  return `레벨 ${String(level)}, 한 번에 ${formatOkrw(perOrderLimit)}까지`;
}
