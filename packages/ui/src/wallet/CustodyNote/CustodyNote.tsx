import { memo } from 'react';
import styles from './CustodyNote.module.css';

/** D-24 "밝히는 문구": the words on the wallet screen (no chain words, D-17). */
export const CUSTODY_NOTE_PLAIN = '체험판이에요. 용이 용돈은 지금 시켜용이 대신 맡아 두고 있어요.';

/**
 * D-24 "밝히는 문구": the words inside 자세히 보기. Plain words a person understands: it may
 * name the wallet briefly, but never a decision id or an internal product name (QA 5).
 */
export const CUSTODY_NOTE_DETAILED =
  // verify-allow: D17 자세히 보기 안에서만 보이는 문구 (D-24)
  '테스트용 체험판이에요. 용이의 열쇠와 주인 권한을 지금은 시켜용 서버가 대신 보관하고 있어요. 나중에는 주인님의 지갑이 이 권한을 직접 갖게 돼요.';

export interface CustodyNoteProps {
  /** 자세히 보기가 켜져 있으면 정확한 설명 문구를 쓴다. */
  readonly detailed?: boolean;
}

/**
 * One small line at the bottom of the wallet screen saying the operator holds the
 * dragon's money for now (D-24). The page renders it only when MeView.custodial is true.
 */
export const CustodyNote = memo(function CustodyNote({ detailed = false }: CustodyNoteProps) {
  return <p className={styles.note}>{detailed ? CUSTODY_NOTE_DETAILED : CUSTODY_NOTE_PLAIN}</p>;
});
