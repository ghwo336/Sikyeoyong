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
`items: readonly { id: string; store: string; eta: string (부모가 만든 "25분"); menu: string; price: bigint (aokrw); needsApproval?: boolean }[]`, `onPick: (id: string) => void`, `loading?: boolean`

## 하네스 상태
`RecommendationList.stories.tsx`에 아래를 전부 만든다.
- 세 개 (`Three`)
- 허락 필요 표시 포함 (`WithApproval`, Main 시안)
- 로딩 스켈레톤 (`Loading`)
- 추천 없음 (`Empty`, 아무것도 그리지 않음)

## 쓰는 화면
Main

## 테스트 기준
- needsApproval이면 '허락 필요' 표시, 아니면 없음
- 가격 formatOkrw. 원 아래 끝수와 Number를 넘는 큰 금액으로 확인한다 (손으로 쓴 기대값)
- 버튼 이름은 "가게, 시간 메뉴 가격 [허락 필요]"처럼 띄어 읽힌다. 목록은 role list, 로딩은 role status
- 포커스 테두리는 카드 안쪽(-2px)이라 잘리지 않는다
- 줄마다 버튼 하나 ("가게, 시간" / 메뉴 / 가격), 누르면 onPick(id) 한 번, 줄 사이에만 구분선
- 로딩이면 회색 줄 3개와 aria-busy, 버튼 없음, 움직임 없음
- 추천이 없으면 그리지 않는다
- Main 시안 값 (카드 1px `line` 반경 20, 줄 64 여백 14 16 간격 12, 구분선 `track`, 가게 12px, 메뉴와 가격 16/600, 허락 필요 11/600 `yolkInk` on `yolkTint`)

## 메모
- 불러오는 중 줄의 막대는 base `Skeleton` meta(40%, 65%)다. 줄 틀(높이, 여백)은 이 컴포넌트가 그린다.
- 추천이 없을 때 할 말은 용이 말(DragonLine)이 한다. 카드는 비워 두지 않고 아예 그리지 않는다.
- 스켈레톤은 반짝임 없이 멈춘 회색 줄이다 (동작 줄이기와 상관없이 같다).
- `type.meta`, `type.badge`, `size.pickRow`, `size.pickRowPadY`, `size.pickMetaGap`, `size.badgePadX/Y` 토큰을 쓴다.
