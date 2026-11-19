---
node: leaf
parent: _index.md
children: []
---

# OrderConfirmSheet

`packages/ui/src/order/OrderConfirmSheet/`

## 책임
주문 내용, 결제 금액, 한도 막대 두 개, 시키기 버튼을 시트 안에 그린다.

## 책임 아님
결제 (onConfirm만 부름), 한도 판정

## props
`store`, `items`, `total: bigint`, `perOrder: { used: bigint, max: bigint }`, `period: { used: bigint, max: bigint }`, `onConfirm`, `onCancel`, `confirming?`

## 하네스 상태
`OrderConfirmSheet.stories.tsx`에 아래를 전부 만든다.
- 기본
- 한도 거의 참
- 결제 중
- 가격 변경 다시 확인

## 쓰는 화면
Confirm

## 테스트 기준
- onConfirm 한 번만
- confirming 중 버튼 잠금

## 메모
없음
