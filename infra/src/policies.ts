import { PolicySet, policy, type RawPolicySet } from '@maroo-chain/viem';
import { getPolicy, type PolicyProfile } from '@sikyeoyong/shared';
import { keccak256, stringToHex, toFunctionSelector, type Hex } from 'viem';

/**
 * The contract-scope policies of SikyeoyongOrders (tech-spec 5.6, D-07, D-12, D-33).
 * Values come from packages/shared policy.ts. The root list is the FULL set:
 * changeContractPolicies replaces everything (chain-and-pcl.md).
 */
export const PLACE_ORDER_SIGNATURE = 'placeOrder(uint64,bytes32)';
export const REGISTER_MERCHANT_SIGNATURE = 'registerMerchant(bytes32,string)';

export interface KybPolicyInput {
  readonly easContract: `0x${string}`;
  readonly indexContract: `0x${string}`;
  readonly schemaUid: Hex;
}

export interface BuildOptions {
  readonly profile: PolicyProfile;
  /** Native OKRW denom of the network (shared chain config), for example atokrw. */
  readonly okrwDenom: string;
  /** Required for the default profile (EAS on registerMerchant). The demo profile has none (D-33). */
  readonly kyb?: KybPolicyInput | undefined;
}

export function buildOrdersPolicies(options: BuildOptions): RawPolicySet[] {
  const cfg = getPolicy(options.profile);
  const placeOrder = policy.and(
    [
      policy.agentOkrwTransferLimit(),
      policy.periodicVolume({
        limits: [
          {
            token: options.okrwDenom,
            maxAmount: cfg.periodicCapAokrw,
            resetPeriodSeconds: BigInt(cfg.periodicPeriodSec),
          },
        ],
      }),
    ],
    { selector: toFunctionSelector(PLACE_ORDER_SIGNATURE) },
  );
  const policies = [placeOrder];
  if (options.profile === 'default') {
    if (options.kyb === undefined) {
      throw new Error('the default profile needs the KYB schema (EAS policy on registerMerchant)');
    }
    policies.push(
      policy.eas({ ...options.kyb, selector: toFunctionSelector(REGISTER_MERCHANT_SIGNATURE) }),
    );
  }
  return policies;
}

export interface PolicySummaryChild {
  template: string;
  value: Record<string, string>;
}

export interface PolicySummary {
  selector: string;
  signature: string;
  root: string;
  quantifier?: string;
  children: PolicySummaryChild[];
}

const KNOWN_SIGNATURES = [PLACE_ORDER_SIGNATURE, REGISTER_MERCHANT_SIGNATURE];

function signatureOf(selector: string): string {
  return KNOWN_SIGNATURES.find((s) => toFunctionSelector(s) === selector) ?? 'unknown';
}

/** bigint to decimal text, nested arrays and objects flattened for reading (JSON has no bigint). */
function plain(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));
}

function leaf(node: ReturnType<typeof PolicySet.decode>): PolicySummaryChild {
  if (node.kind === 'opaque') return { template: node.templateId, value: { opaque: node.reason } };
  const entries = Object.entries(node.value as Record<string, unknown>);
  return {
    template: node.templateId,
    value: Object.fromEntries(entries.map(([k, v]) => [k, plain(v)])),
  };
}

/** A decoded, readable summary of raw policies (what the chain returned or what we built). */
export function summarizePolicies(raw: readonly RawPolicySet[]): PolicySummary[] {
  return raw.map((r) => {
    const node = PolicySet.decode(r);
    const base = {
      selector: r.selector.toLowerCase(),
      signature: signatureOf(r.selector.toLowerCase()),
    };
    if (node.kind === 'decoded' && node.templateId === 'LOGICAL_POLICY') {
      return {
        ...base,
        root: node.templateId,
        quantifier: node.value.quantifier,
        children: node.value.children.map(leaf),
      };
    }
    return { ...base, root: node.templateId, children: [leaf(node)] };
  });
}

/** Order-independent comparison key of a raw policy list (templateId, selector, payload bytes). */
function key(r: RawPolicySet): string {
  return `${r.selector.toLowerCase()}|${r.templateId}|${r.policy.toLowerCase()}`;
}

export function policyHash(raw: readonly RawPolicySet[]): Hex {
  return keccak256(stringToHex([...raw].map(key).sort().join('\n')));
}

export interface PolicyDiff {
  /** On chain exactly as wanted. */
  same: boolean;
  /** Selectors on chain that policy.ts does not manage. A full replace would delete them. */
  unmanaged: string[];
  /** Selectors wanted but missing on chain. */
  missing: string[];
  /** Selectors on both sides with different content. */
  changed: string[];
}

export function diffPolicies(
  current: readonly RawPolicySet[],
  wanted: readonly RawPolicySet[],
): PolicyDiff {
  const cur = new Map(current.map((r) => [r.selector.toLowerCase(), key(r)]));
  const want = new Map(wanted.map((r) => [r.selector.toLowerCase(), key(r)]));
  const unmanaged = [...cur.keys()].filter((s) => !want.has(s));
  const missing = [...want.keys()].filter((s) => !cur.has(s));
  const changed = [...want.keys()].filter((s) => cur.has(s) && cur.get(s) !== want.get(s));
  return {
    same: unmanaged.length + missing.length + changed.length === 0,
    unmanaged,
    missing,
    changed,
  };
}
