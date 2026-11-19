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
`open: boolean`, `line: string` (위 용이 말), `species: DragonSpecies`, `route: string` ("가게에서 어디로, 25분쯤"), `items: readonly OrderLine[]` (OrderSummary와 같은 줄), `request?: string`, `total: bigint` (aokrw, 서버 견적 그대로), `perOrder: { used: bigint; max: bigint; tone?: MeterTone }` ("한 번에"), `period: { used: bigint; max: bigint; tone?: MeterTone }` ("30일 동안 (주문 후)"), `onConfirm: () => void`, `onCancel: () => void`, `confirming?: boolean`, `priceChangedFrom?: bigint` (가격이 바뀌기 전 금액, D-19)

## 하네스 상태
`OrderConfirmSheet.stories.tsx`에 아래를 전부 만든다.
- 기본 (`Default`, Confirm 시안)
- 한도 거의 참 (`NearLimit`)
- 결제 중 (`Confirming`)
- 가격 변경 다시 확인 (`PriceChanged`)

## 쓰는 화면
Confirm

## 테스트 기준
- onConfirm 한 번만 (다시 그리기 전에 두 번 눌러도 한 번)
- confirming 중 버튼 잠금 (aria-busy)
- 결제가 실패해 confirming이 풀리면 다시 누를 수 있다 (같은 주문으로 재시도, D-19)
- 금액은 formatOkrw로 버튼과 결제할 금액에 서버 값 그대로. Number를 넘는 금액으로 확인
- 한도 막대 두 개는 Meter `kind="limit"`, 이름 "한 번에", "30일 동안 (주문 후)", tone은 부모가 준 그대로
- "다시 고를래", Esc로 onCancel
- 가격이 바뀌었으면 알림 문구 (role alert)
- Confirm 시안 값 (주문 간격 10, 줄 16px, 결제할 금액 24/700, 한도 간격 14, 버튼 사이 4)

## 메모
- 틀은 base `Sheet`, 위 말은 `DragonLine` sheet 배치, 막대는 `Meter` limit, 버튼은 `Button` primary와 text다.
- 두 번 누름 잠금은 ref로 잡고, 부모가 confirming을 내린 다음 그리기에서 풀린다. 부모는 onConfirm을 받으면 confirming을 올려야 한다.
- 가격 변경 문구는 시안에 없다 (디자인 선택). 시안 문구가 생기면 바꾼다.
- 결제는 하지 않는다. onConfirm은 `POST /api/orders/:id/confirm`을 부르는 부모 콜백이다 (CLAUDE.md 절대 규칙 3).
