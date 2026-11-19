---
node: leaf
parent: _index.md
children: []
---

# StepProgress

`packages/ui/src/base/StepProgress/`

## 책임
몇 단계 중 몇 번째인지 칸으로 그린다 (가입 3단계, 주문 4단계).

## 책임 아님
단계 이름 정하기 (props로 받음)

## props
`steps: string[]`, `current: number`, `showLabels?: boolean`

## 하네스 상태
`StepProgress.stories.tsx`에 아래를 전부 만든다.
- 가입 1/3
- 주문 조리 중
- 모두 완료

## 쓰는 화면
Verify, Name, Budget, Done, Tracking, Arrived

## 테스트 기준
- aria-label에 'N단계 중 M단계'
- current 범위 밖 값 방어

## 메모
없음
