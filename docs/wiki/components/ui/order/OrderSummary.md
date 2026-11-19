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
`store: string` (맨 윗줄), `when?: string` (윗줄 오른쪽, Receipt 시각), `items: readonly { name: string; quantity: number; price: bigint }[]` (price는 그 줄의 aokrw), `request?: string` ("요청:" 없이), `total: bigint` (aokrw), `details?: readonly { label: string; value: string }[]` (Receipt 아래 작은 줄)

## 하네스 상태
`OrderSummary.stories.tsx`에 아래를 전부 만든다.
- 메뉴 하나 (`OneItem`, Done 시안)
- 메뉴 여럿 (`ManyItems`)
- 요청 없음 (`NoRequest`)
- 영수증 (`Receipt`, 시각과 결제 수단, 한 번에, 30일 줄)

## 쓰는 화면
Done, Receipt

## 테스트 기준
- 합계는 서버가 준 값 그대로 (줄 가격을 더하지 않는다), formatOkrw로만 보인다
- 줄은 "이름 N개"와 가격
- 요청은 "요청: "을 붙여 보이고, 없거나 빈 글자면 없다
- Receipt 시각은 윗줄 오른쪽에, 아래 줄은 dt, dd 쌍
- Number를 넘는 큰 금액도 정확히 보인다
- 시안 값 (카드 여백 16 간격 10, 윗줄 13px, 메뉴 15px, 요청과 아래 줄 14px `ink-secondary`, 구분선 `track`, 결제한 금액 15/600과 17/700)

## 메모
- 메뉴 줄과 요청은 같은 영역의 `OrderLines` `size="body"`(15px, 간격 8)로 그린다. OrderConfirmSheet와 같은 부품 (D-18 원칙 5). `OrderLine` 타입은 OrderLines에 있고 여기서 다시 내보낸다.
- Receipt 카드의 "결제 수단, 한 번에 쓸 수 있는 돈, 30일 한도" 줄은 `details`로 이 컴포넌트가 그린다 (ListRow가 아니다).
- Receipt 시안의 카드 간격은 8, 구분선 위아래 4다. Done 값(10, 2)으로 통일했다 (디자인 선택. Receipt 조립 때 시안을 따를지 다시 본다).
- Confirm의 주문 내용(카드 없음, "결제할 금액" 24/700)은 OrderConfirmSheet가 그린다.
