---
node: leaf
parent: _index.md
children: []
---

# RecommendationList

`packages/ui/src/order/RecommendationList/`

## 책임
추천 가게와 메뉴 2~3개를 한 묶음 목록으로 그린다.

## 책임 아님
추천 계산 (서버)

## props
`items: { id, store, eta, menu, price: bigint, needsApproval?: boolean }[]`, `onPick(id)`

## 하네스 상태
`RecommendationList.stories.tsx`에 아래를 전부 만든다.
- 세 개
- 허락 필요 표시 포함
- 로딩 스켈레톤
- 추천 없음

## 쓰는 화면
Main

## 테스트 기준
- needsApproval이면 '허락 필요' 표시
- 가격 formatOkrw

## 메모
없음
