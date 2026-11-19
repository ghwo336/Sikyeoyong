---
node: leaf
parent: _index.md
children: []
---

# OrderSummary

`packages/ui/src/order/OrderSummary/`

## 책임
가게, 메뉴, 요청, 결제 금액을 그린다.

## 책임 아님
금액 계산

## props
`store`, `items`, `request?`, `total: bigint`

## 하네스 상태
`OrderSummary.stories.tsx`에 아래를 전부 만든다.
- 메뉴 하나
- 메뉴 여럿
- 요청 없음

## 쓰는 화면
Done, Receipt

## 테스트 기준
- 합계는 서버가 준 값 그대로

## 메모
없음
