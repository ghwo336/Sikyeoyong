---
node: internal
parent: ../_index.md
children:
  - RecommendationList.md
  - OrderConfirmSheet.md
  - OrderStatusHeader.md
  - DeliveryMap.md
  - OrderSummary.md
  - OrderLines.md
  - TasteRating.md
  - ReceiptDetails.md
---

# 주문 (order)

추천, 확인, 기다림, 도착, 상세.

영역 사이 import는 `base`와 `dragon`만 허용한다 (`conventions/architecture.md`).

| 컴포넌트 | 책임 |
| --- | --- |
| [RecommendationList](RecommendationList.md) | 추천 가게와 메뉴 2~3개를 한 묶음 목록으로 그린다. |
| [OrderConfirmSheet](OrderConfirmSheet.md) | 주문 내용, 결제 금액, 한도 막대 두 개, 시키기 버튼을 시트 안에 그린다. |
| [OrderStatusHeader](OrderStatusHeader.md) | 도착 예정 시각(분 단위)과 남은 시간을 크게 그린다. |
| [DeliveryMap](DeliveryMap.md) | 가게에서 집까지 경로와 라이더 위치를 그린다. |
| [OrderSummary](OrderSummary.md) | 가게, 메뉴, 요청, 결제 금액을 그린다. |
| [OrderLines](OrderLines.md) | 메뉴 줄("이름 N개"와 가격)과 요청 한 줄을 그린다. OrderSummary와 OrderConfirmSheet가 함께 쓴다. |
| [TasteRating](TasteRating.md) | 맛 평가 세 가지 중 하나를 고르게 한다. |
| [ReceiptDetails](ReceiptDetails.md) | 자세히 보기를 접고 펼치며 결제 기록 번호, 신분증 번호, 통과한 마루 규칙, 탐색기 링크를 그린다. |
