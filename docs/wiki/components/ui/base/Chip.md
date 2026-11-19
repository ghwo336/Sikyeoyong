---
node: leaf
parent: _index.md
children: []
---

# Chip

`packages/ui/src/base/Chip/`

## 책임
고를 수 있는 작은 알약 버튼(빠른 답장, 예산 고르기, 맛 평가)을 그린다.

## 책임 아님
여러 개 중 하나만 고르는 규칙 (부모나 `ChipGroup` 역할은 페이지 조립에서)

## props
`selected?: boolean` (주면 여럿 중 하나 고르기라 radio와 aria-checked, 안 주면 빠른 답장 버튼), `onPress: () => void`, `children: ReactNode`, `size?: 'sm' | 'lg' | 'tile'` (기본 `sm`), `numeric?: boolean` (고정폭 숫자), `tabIndex?: number` (radio 그룹이 Tab 순서를 정할 때, `base/radio-group.ts`)

## 하네스 상태
`Chip.stories.tsx`에 아래를 전부 만든다.
- 기본
- 선택됨
- 고정폭 숫자

## 쓰는 화면
Main, Budget, Arrived

## 테스트 기준
- selected일 때 aria-checked
- onPress

## 메모
- `sm`은 Main 빠른 답장: 높이 36(`size.chip`), 좌우 여백 14(`size.chipPaddingX`), 1px `line-strong` 테두리, 흰 바탕, 알약, 14px(`type.chip`). 보이는 높이는 36이지만 누르는 영역은 투명하게 44로 넓힌다.
- `lg`는 Budget 예산: 높이 52(`size.input`), 반경 14, 16/600(`type.row`).
- `tile`은 Arrived 맛 평가: `lg`와 같은 52 칸이지만 글자는 15/400(`type.body`). Arrived 시안의 맛 평가에는 고른 상태가 없다. TasteRating이 고르기(radio)로 쓴다.
- 고르면 2px 잎색 테두리, 연한 잎색 바탕, `leaf-pressed` 글자색.
- 누름은 Button과 같은 0.97 스프링, 동작 줄이기면 없음.
- 고르기 묶음의 키보드(Tab 한 번으로 들어가고 화살표로 옮기며 고름, Home, End)는 `base/radio-group.ts`의 `radioGroupKeyDown`, `radioTabIndex`가 맡는다. TasteRating, BudgetPicker가 쓰고 EggPicker도 쓸 예정이다. 보조키(Alt, Ctrl, Cmd)와 함께 누른 화살표는 브라우저에 맡긴다.
