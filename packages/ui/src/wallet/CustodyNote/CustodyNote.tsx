import { memo } from 'react';
import styles from './CustodyNote.module.css';

/** D-24 "밝히는 문구": the words on the wallet screen (no chain words, D-17). */
export const CUSTODY_NOTE_PLAIN = '체험판이에요. 용이 용돈은 지금 시켜용이 대신 맡아 두고 있어요.';

/** D-24 "밝히는 문구": the exact words inside 자세히 보기 (demo) and the README. */
export const CUSTODY_NOTE_DETAILED =
  // verify-allow: D17 자세히 보기 안에서만 보이는 정확한 문구 (D-24, D-31)
  '테스트넷 데모. 에이전트 키와 소유자 권한은 운영자 서버가 보관한다(수탁, D-24). 파우치 임베디드 SDK가 나오면 사용자 지갑이 소유자가 된다.';

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
