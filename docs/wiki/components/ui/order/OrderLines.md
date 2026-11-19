---
node: leaf
parent: _index.md
children: []
---

# OrderLines

`packages/ui/src/order/OrderLines/`

## 책임
메뉴 줄("돼지국밥 1개"와 그 줄 가격)과 그 아래 요청 한 줄("요청: 깍두기 많이")을 그린다.

## 책임 아님
합계 (서버 값을 부모가 그린다, 줄 가격을 더하지 않는다), 가게 이름, 카드 틀, 줄 사이 바깥 간격 (부모의 gap)

## props
`items: readonly { name: string; quantity: number; price: bigint }[]` (price는 그 줄의 aokrw), `request?: string` ("요청:" 없이, 빈 문자열이면 안 그림), `size: 'body' | 'row'` (body: 15px 간격 8, Done과 Receipt / row: 16px 간격 10, Confirm)

## 하네스 상태
`OrderLines.stories.tsx`에 아래를 전부 만든다.
- 영수증 크기 (`Body`)
- 확인 시트 크기 (`Row`)
- 여러 줄, 요청 없음 (`ManyNoRequest`)

## 쓰는 화면
Confirm(`OrderConfirmSheet`), Done과 Receipt(`OrderSummary`)

## 테스트 기준
- 줄은 "이름 N개"와 formatOkrw 가격, 주어진 순서대로. Number를 넘는 금액도 정확히
- 요청은 "요청:"을 붙이고, 없거나 빈 문자열이면 문단이 없다
- size 클래스가 목록에 붙는다
- 시안 값 (body 15px 간격 8, row 16px 간격 10, 요청 14px `ink-secondary`, 숫자 tabular)

## 메모
- 2026-11-19 재사용 감사(D-18 원칙 5): OrderConfirmSheet가 OrderSummary의 줄 마크업을 복사하고 있어서 뽑았다. 두 화면은 글자 크기와 간격만 달라 `size` 하나로 가른다.
- 목록과 요청 문단 두 형제를 돌려준다(감싸는 요소 없음). 부모 블록의 gap이 그대로 둘 사이를 띄운다.
- `OrderLine` 타입의 원본은 여기다. OrderSummary가 다시 내보내서 기존 import는 그대로 된다.
