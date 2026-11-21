import {
  type ChainConfig,
  type OrderReceipt,
  explorerTxUrl,
  zOrderReceipt,
} from '@sikyeoyong/shared';

/** The payment paths whose chain is the real one. The mock path is a stand-in (CLAUDE.md rule 11). */
type ReceiptPath = 'A' | 'B' | 'C' | 'mock';

/**
 * The checks a paid order went through, as the receipt's 자세히 보기 lists them (tech-spec 2.5,
 * Receipt.dc.html). An order only becomes paid after the server's rules held at confirm and the
 * chain executed the payment, so each one below passed. The policy names are for the details
 * view only (D-17).
 */
const SERVER_RULES = [
  { id: 'server-frozen', label: '용이 멈춤 아님 (서버 확인)' },
  { id: 'server-budget', label: '내 30일 한도 (서버 확인)' },
  { id: 'server-new-store', label: '새 가게 허락 (서버 확인)' },
] as const;

const CHAIN_RULES = [
  { id: 'transfer-limit', label: 'AGENT_OKRW_TRANSFER_LIMIT_POLICY (건당 한도)' },
  { id: 'periodic-volume', label: 'PERIODIC_VOLUME_POLICY (30일 한도)' },
  { id: 'kyc', label: '전역 KYC 한도' },
] as const;

/**
 * The mock chain only imitates the per-order and 30-day limits (payment.md `PAYMENT_PATH=mock`),
 * so its receipt says so by name and lists no global KYC check it never ran (rule 11).
 */
const MOCK_CHAIN_RULES = [
  { id: 'mock-transfer-limit', label: '건당 한도 (흉내 체인)' },
  { id: 'mock-periodic-volume', label: '30일 한도 (흉내 체인)' },
] as const;

export interface ReceiptInput {
  /** ERC-8004 id of the dragon, null when it has none (no receipt then). */
  readonly onchainAgentId: string | null;
  readonly txHash: string;
  readonly path: ReceiptPath;
  readonly chain: ChainConfig;
}

/** The receipt JSON stored in orders.receipt_json, or null when it cannot be built honestly. */
export function buildReceiptJson(input: ReceiptInput): string | null {
  if (input.onchainAgentId === null) return null;
  const chainRules = input.path === 'mock' ? MOCK_CHAIN_RULES : CHAIN_RULES;
  const receipt: OrderReceipt = {
    agentId: input.onchainAgentId,
    rules: [
      ...SERVER_RULES.map((r) => ({ ...r, layer: 'server' as const, status: 'passed' as const })),
      ...chainRules.map((r) => ({ ...r, layer: 'chain' as const, status: 'passed' as const })),
    ],
    explorerUrl: explorerTxUrl(input.chain, input.txHash),
  };
  return JSON.stringify(zOrderReceipt.parse(receipt));
}

/** Reads a stored receipt back; a missing or unreadable one is no receipt (never throws). */
export function parseReceiptJson(raw: string | null): OrderReceipt | undefined {
  if (raw === null) return undefined;
  try {
    const parsed = zOrderReceipt.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
