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
`selected?: boolean`, `onPress`, `children`

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
없음
