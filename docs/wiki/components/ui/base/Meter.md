---
node: leaf
parent: _index.md
children: []
---

# Meter

`packages/ui/src/base/Meter/`

## 책임
현재 값과 한도를 막대로 그린다 (예산, 한 번에, 30일).

## 책임 아님
넘었는지 판단해서 문구 바꾸기 (부모가 `tone`을 넘김)

## props
`value: bigint`, `max: bigint`, `label`, `tone: 'normal' | 'warn' | 'over'`

## 하네스 상태
`Meter.stories.tsx`에 아래를 전부 만든다.
- 30%
- 70% 노른자
- 100% 호박색
- 0

## 쓰는 화면
Main, Confirm, Arrived

## 테스트 기준
- value가 max보다 커도 막대는 100%
- 숫자는 formatOkrw

## 메모
없음
