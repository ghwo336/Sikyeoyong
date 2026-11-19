---
node: leaf
parent: _index.md
children: []
---

# OrderStatusHeader

`packages/ui/src/order/OrderStatusHeader/`

## 책임
도착 예정 시각(분 단위)과 남은 시간을 크게 그린다.

## 책임 아님
시간 계산 (서버가 eta를 줌)

## props
`etaAt: number`(unix ms), `remainingMin: number`, `variant: 'eta-first' | 'remaining-first'`

## 하네스 상태
`OrderStatusHeader.stories.tsx`에 아래를 전부 만든다.
- 조리 중
- 배달 중
- 지연 갱신

## 쓰는 화면
Done, Tracking

## 테스트 기준
- KST로 'N시 M분' 표시
- 고정폭 숫자

## 메모
없음
