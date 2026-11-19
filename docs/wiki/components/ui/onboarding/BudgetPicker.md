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
`options: readonly bigint[]` (aokrw), `value: bigint` (aokrw), `onChange: (value: bigint) => void`

## 하네스 상태
`BudgetPicker.stories.tsx`에 아래를 전부 만든다.
- 30만 선택 (`Thirty`, Budget 시안)
- 다른 값 선택 (`Fifty`)

## 쓰는 화면
Budget

## 테스트 기준
- 고정폭 숫자, '만 원' 표기 (`formatManWon`, bigint만. 만 원 단위로 딱 떨어지지 않으면 보통 표기 "123,456원")
- 제목이 이름인 radiogroup, Chip lg numeric 세 칸, 고른 값만 aria-checked
- 클릭과 화살표 키로 onChange(bigint), Tab은 고른 칸으로 들어간다 (`base/radio-group.ts`)
- Budget 시안 값 (제목 15/600, 세 칸 같은 폭, 간격 8, 제목과 칸 사이 10)

## 메모
- "만 원" 표기는 open-questions Q-23이 정한다. 정해지면 `formatManWon`만 바꾼다.
- 체험용 용돈 줄(Budget 시안 아래)은 이 컴포넌트가 아니라 화면이 그린다.
