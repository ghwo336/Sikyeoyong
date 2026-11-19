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
`selected?: boolean` (주면 여럿 중 하나 고르기라 radio와 aria-checked, 안 주면 빠른 답장 버튼), `onPress: () => void`, `children: ReactNode`, `size?: 'sm' | 'lg'` (기본 `sm`), `numeric?: boolean` (고정폭 숫자)

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
- `sm`은 Main 빠른 답장: 높이 36(`size.chip`), 알약, 14px(`type.chip`). 보이는 높이는 36이지만 누르는 영역은 투명하게 44로 넓힌다.
- `lg`는 Budget 예산과 Arrived 맛 평가: 높이 52(`size.input`), 반경 14, 16/600. 고르면 2px 잎색 테두리와 연한 잎색 바탕.
- 누름은 Button과 같은 0.97 스프링, 동작 줄이기면 없음.
