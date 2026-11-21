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
`field: LimitField` (`packages/shared`, `'perOrder' | 'myPeriodic'`), `from: bigint`, `to: bigint` (aokrw), `needsReauth: boolean`, `rows?: readonly { label: string; value: string }[]` (부모가 만든 아래 줄, "30일에 쓸 돈 300,000원 그대로"), `onConfirm: () => void`, `onCancel: () => void`, `status?: 'idle' | 'confirming' | 'failed'`, `hideTitle?: boolean` (머리글이 이미 "한도 바꾸기"라 카드 제목을 뺀다)

## 하네스 상태
`LimitChangeCard.stories.tsx`에 아래를 전부 만든다.
- 올리기(재인증) (`RaiseWithReauth`, LimitChat 시안)
- 내리기(바로) (`Lower`)
- 30일에 쓸 돈 바꾸기 (`MyPeriodic`)
- 확인 중 (`Confirming`)
- 실패 (`Failed`)
- 제목 없음 (`WithoutTitle`)

## 쓰는 화면
LimitChat

## 테스트 기준
- needsReauth면 'Face ID로 확인하고 바꾸기'(아이콘 포함), 아니면 '바꾸기'
- LLM이 만든 카드라도 확정은 버튼으로만: 그릴 때, 다른 곳 Enter로 onConfirm이 불리지 않고 카드가 포커스를 가져가지 않는다
- 부모가 다시 그리지 않아도 두 번 누르면 onConfirm 한 번 (ref 잠금), 처음부터 확인 중으로 그려지면 누르지 못함(aria-busy), 실패하면 다시 누를 수 있고 알림 문구
- 전과 후는 formatOkrw, "A에서 B으로"로 읽힌다 (전 금액은 취소선). Number를 넘는 금액으로 확인
- 바꾸는 칸 이름은 perOrder "한 번에 쓸 돈", myPeriodic "30일에 쓸 돈" (D-31)
- `hideTitle`이면 제목 줄만 없다 (구역 이름 "한도 바꾸기"와 나머지는 그대로)
- 레벨 줄이 없다. 아래 줄은 부모가 준 `rows`뿐 (없으면 줄 묶음도 없다)
- 뿌리에 `data-theme="fixed"`: 금액과 Face ID 확인이라 종이 바뀌어도 기본(숲) 색 (D-32)
- LimitChat 시안 값 (2px 잎색 테두리 반경 20, 여백 16, 간격 14, 바뀐 뒤 22/700, 확인 버튼 52 반경 16, 그만두기 44, 버튼 사이 6)

## 메모
- 전후 금액은 base `AmountChange`다 (화살표 아이콘과 "에서, 으로" 숨은 글자 포함).
- 실패 줄은 base `ErrorLine`, 두 버튼 묶음은 base `ActionPair` sm(6)이다.
- `rows`는 base `DetailRows` inline small loose로 그린다.
- 전후 사이 화살표는 base `Icon` `arrow-right`, Face ID 그림은 base `Icon` `face-id`(선 1.8)다.
- LLM은 변경 카드만 만든다 (user-flow 13단계). Claude가 `propose_limit_change`로 칸(`perOrder` 또는 `myPeriodic`)과 금액을 고르면 서버가 범위를 확인하고 전과 후 금액을 붙여 이 카드를 띄운다 (D-21, D-31). 바꾸는 일은 이 버튼을 누른 뒤 부모가 한다. 올리기는 둘 다 재인증 뒤, 내리기는 바로 (CLAUDE.md 절대 규칙 3, LLM 도구에 정책 변경 없음).
- 확인 중에도 그만두기는 눌린다. 진행 중인 재인증이나 변경을 어떻게 할지는 부모(LimitChat 조립)가 정한다.
- 버튼 두 개는 base `Button`이다: 바꾸기는 primary `choice`(52, 반경 16, 16/700, Face ID 아이콘은 `icon`), 그만두기는 text `md`(44, 15/400).
- 두 번 누름 잠금은 base 훅 `useSubmitLock`(OrderConfirmSheet와 같은 훅)이다.
- 실패 문구와 확인 중 모양은 시안에 없다 (디자인 선택).
- 2026-11-20 D-31로 레벨이 없어져 `levelFrom`, `levelTo`와 레벨 줄을 뺐고, `monthlyBudget`은 `myPeriodic`(30일에 쓸 돈)이 됐다. 칸 목록은 shared `LimitField` 하나를 쓴다. LimitChat 시안의 "한 번에 쓸 수 있는 돈"은 D-31 말("한 번에 쓸 돈")로 맞췄다.
