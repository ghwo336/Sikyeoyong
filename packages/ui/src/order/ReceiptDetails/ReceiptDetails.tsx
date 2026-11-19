'use client';

import { useId, useState } from 'react';
import styles from './ReceiptDetails.module.css';

export interface ReceiptDetailsProps {
  /** Payment record number (transaction hash), shown shortened. */
  readonly txHash: string;
  /** The dragon's ID card number. */
  readonly agentId: string;
  /** Rule names the chain actually checked, from the server receipt (tech-spec 2.5). */
  readonly rules: readonly string[];
  readonly explorerUrl: string;
  readonly defaultOpen?: boolean;
}

/** Only https links leave the app (no javascript: or plain http). */
function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** "0x8f3a…c21e": the first 6 and last 4 characters. Short values stay as they are. */
export function shortHash(hash: string): string {
  return hash.length <= 12 ? hash : `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

/**
 * Opens and closes "자세히 보기" with the record number, ID card number, the rules
 * that passed and a link to the explorer. Chain words live only in here (ReceiptDetails.md).
 */
export function ReceiptDetails({
  txHash,
  agentId,
  rules,
  explorerUrl,
  defaultOpen = false,
}: ReceiptDetailsProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className={styles.card}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          setOpen((o) => !o);
        }}
      >
        자세히 보기
        <svg
          className={styles.chevron}
          data-open={open || undefined}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div id={panelId} className={styles.panel}>
          <div className={styles.row}>
            <span className={styles.label}>결제 기록 번호</span>
            <span className={styles.code} title={txHash}>
              {shortHash(txHash)}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>용이 신분증 번호</span>
            <span className={styles.num}>{agentId}</span>
          </div>
          {rules.length > 0 ? (
            <div className={styles.rules}>
              <span className={styles.label}>통과한 마루 규칙 {String(rules.length)}개</span>
              <ul className={styles.ruleList}>
                {rules.map((r, i) => (
                  // The same label can come twice; the order is fixed.
                  <li key={`${String(i)}-${r}`}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {isHttps(explorerUrl) ? (
            <a className={styles.link} href={explorerUrl} target="_blank" rel="noopener noreferrer">
              마루 탐색기에서 보기
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
