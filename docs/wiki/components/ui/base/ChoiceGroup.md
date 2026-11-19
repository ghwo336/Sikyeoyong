---
node: leaf
parent: _index.md
children: []
---

# ChoiceGroup

`packages/ui/src/base/ChoiceGroup/`

## 책임
하나만 고를 수 있는 선택지 묶음(라디오 그룹)을 질문과 함께 그리고, 키보드 규칙(Tab 한 번, 화살표로 이동하며 고르기)을 맡는다.

## 책임 아님
선택지 하나의 모양 (`renderOption`이 Chip이나 알 버튼을 그린다), 저장 (부모 `onChange`), 무엇을 고를지 목록 (부모)

## props
`options: readonly T[]`, `value: T | undefined`, `onChange: (value: T) => void`, `keyOf: (option: T) => string`, `renderOption: (option: T, state: { selected: boolean; tabIndex: 0 | -1; select: () => void }) => ReactNode` (role radio 요소를 돌려준다), `layout: 'columns' | 'row'` (columns: 같은 너비 칸 간격 8 / row: 내용 너비 간격 10), `title?: string` (보이는 질문 15/600), `label?: string` (제목이 없을 때 화면 읽기 이름)

## 하네스 상태
`ChoiceGroup.stories.tsx`에 아래를 전부 만든다.
- 아직 안 고름 (`Unpicked`)
- 하나 고름 (`Picked`)
- 제목 없이 한 줄 (`RowNoTitle`)

## 쓰는 화면
Budget(`BudgetPicker`), Arrived(`TasteRating`), Name(`EggPicker`, 제목 없이 row)

## 테스트 기준
- radiogroup 이름은 보이는 제목, 없으면 label. 제목이 없으면 문단도 없다
- 고른 것만 aria-checked
- 누르면 onChange 한 번, 그 선택지로
- Tab은 고른 것(없으면 첫째)으로 한 번만 들어온다
- 화살표로 움직이며 고르고 끝에서 돈다
- 선택지가 감싸는 요소 없이 바로 배치 칸이 된다, layout 클래스
- 시안 값 (제목과 칸 사이 10, 제목 15/600, columns 같은 너비 간격 8, row 간격 10)

## 메모
- 2026-11-19 재사용 감사(D-18 원칙 5)로 BudgetPicker, TasteRating, EggPicker에 복사된 radiogroup 마크업과 `base/radio-group.ts` 연결을 모았다. 키보드 규칙 자체는 `radio-group.ts`에 그대로 있고 이 부품만 부른다.
- columns는 `grid-auto-flow: column`으로 선택지 수만큼 같은 너비 칸을 만든다 (Budget, Arrived 시안은 셋).
- 선택지를 감싸지 않는 이유: Chip이 그리드 칸을 꽉 채워야 시안과 같다.
