---
node: leaf
parent: _index.md
children: []
---

# BudgetPicker

`packages/ui/src/onboarding/BudgetPicker/`

## 책임
이번 달 예산 선택 칩 세 개를 그린다.

## 책임 아님
저장

## props
`options: readonly bigint[]` (aokrw, 세 개 기준. 메모 참고), `value: bigint` (aokrw), `onChange: (value: bigint) => void`

## 하네스 상태
`BudgetPicker.stories.tsx`에 아래를 전부 만든다.
- 30만 선택 (`Thirty`, Budget 시안)
- 다른 값 선택 (`Fifty`)

## 쓰는 화면
Budget

## 테스트 기준
- 고정폭 숫자, formatOkrw 표기 ("300,000원"). 시안의 "30만 원"은 Q-23 결론 대기 (허용되면 packages/shared에 공식 함수를 둔 뒤 바꾼다)
- Number를 넘는 금액도 정확히 보인다
- 제목이 이름인 radiogroup, Chip lg numeric 세 칸, 고른 값만 aria-checked
- 클릭과 화살표 키로 onChange(bigint), Tab은 고른 칸으로 들어간다 (`base/radio-group.ts`)
- Budget 시안 값 (제목 15/600, 세 칸 같은 폭, 간격 8, 제목과 칸 사이 10)

## 메모
- 제목과 칸 묶음, 키보드 규칙은 base `ChoiceGroup` columns이고, 이 컴포넌트는 Chip lg 금액 칸을 넘기기만 한다. 자기 스타일 없음 (CSS 모듈을 두지 않는다, architecture.md).
- 금액 표시는 shared `formatOkrw` 하나로만 한다 (architecture.md, code-style.md). "만 원" 표기는 open-questions Q-23이 정한다.
- options에 같은 값이 두 번 오지 않는다고 본다 (key가 금액).
- 선택지 3개 기준이다. 정책(`packages/shared` `monthlyBudgetOptions`, D-21)이 세 개(small, medium, large)라 하네스와 테스트도 세 칸만 본다. 칸은 같은 너비로 나뉘므로 4개 이상도 그려지지만 360 화면에서 "500,000원" 칸이 좁아진다. 개수가 늘면 시안을 먼저 정하고 테스트를 늘린다.
- 체험용 용돈 줄(Budget 시안 아래)은 이 컴포넌트가 아니라 `TrialAllowance`가 그린다.
