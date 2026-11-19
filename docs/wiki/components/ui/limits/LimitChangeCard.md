---
node: leaf
parent: _index.md
children: []
---

# LimitChangeCard

`packages/ui/src/limits/LimitChangeCard/`

## 책임
말로 요청한 한도 변경을 전과 후로 보여 주고 확인 버튼을 그린다.

## 책임 아님
변경 실행과 재인증 (onConfirm 뒤 부모가 처리)

## props
`field: 'perOrder' | 'monthlyBudget'`, `from: bigint`, `to: bigint` (aokrw), `levelFrom?: number`, `levelTo?: number`, `needsReauth: boolean`, `rows?: readonly { label: string; value: string }[]` (부모가 만든 아래 줄, "30일 한도 500,000원 그대로"), `onConfirm: () => void`, `onCancel: () => void`, `status?: 'idle' | 'confirming' | 'failed'`

## 하네스 상태
`LimitChangeCard.stories.tsx`에 아래를 전부 만든다.
- 올리기(재인증) (`RaiseWithReauth`, LimitChat 시안)
- 내리기(바로) (`Lower`)
- 확인 중 (`Confirming`)
- 실패 (`Failed`)

## 쓰는 화면
LimitChat

## 테스트 기준
- needsReauth면 'Face ID로 확인하고 바꾸기'(아이콘 포함), 아니면 '바꾸기'
- LLM이 만든 카드라도 확정은 버튼으로만: 그릴 때, 다른 곳 Enter로 onConfirm이 불리지 않고 카드가 포커스를 가져가지 않는다
- 부모가 다시 그리지 않아도 두 번 누르면 onConfirm 한 번 (ref 잠금), 처음부터 확인 중으로 그려지면 누르지 못함(aria-busy), 실패하면 다시 누를 수 있고 알림 문구
- 전과 후는 formatOkrw, "A에서 B으로"로 읽힌다 (전 금액은 취소선). Number를 넘는 금액으로 확인
- 레벨 줄은 레벨이 바뀔 때만, 로/으로는 숫자 읽기로
- LimitChat 시안 값 (2px 잎색 테두리 반경 20, 여백 16, 간격 14, 바뀐 뒤 22/700, 확인 버튼 52 반경 16, 그만두기 44, 버튼 사이 6)

## 메모
- LLM은 변경 카드만 만든다 (user-flow 13단계). 카드를 만드는 경로는 정해지지 않았다 (open-questions Q-29). 바꾸는 일은 이 버튼을 눌러 부모가 재인증한 뒤에만 한다 (CLAUDE.md 절대 규칙 3, LLM 도구에 정책 변경 없음).
- 확인 중에도 그만두기는 눌린다. 진행 중인 재인증이나 변경을 어떻게 할지는 부모(LimitChat 조립)가 정한다.
- 버튼 두 개는 base Button과 크기가 달라(52 반경 16, 44 글자 버튼) 이 컴포넌트 CSS로 그리고, 누름은 `base/press.ts`.
- 실패 문구와 확인 중 모양은 시안에 없다 (디자인 선택).
- 레벨 로/으로는 같은 영역의 `LimitBlocked`의 `levelWithRo`를 쓴다.
