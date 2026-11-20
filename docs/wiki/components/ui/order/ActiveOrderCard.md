---
node: leaf
parent: _index.md
children: []
---

# ActiveOrderCard

`packages/ui/src/order/ActiveOrderCard/`

## 책임
대화 화면 예산 카드 아래에 진행 중인 주문 하나(무엇, 지금 단계, 시간 한 줄, 단계 막대)를 누를 수 있는 카드로 그린다 (Main.dc.html, 2026-11-20).

## 책임 아님
어떤 주문을 보일지, 단계와 문구 고르기 (웹이 `orderStep`으로 정해 넘긴다), 어디로 갈지 (onPress)

## props
`menu: string` ("돼지국밥", "돼지국밥 외 1개"), `status: string` ("주문 접수", "조리 중", "배달 중"), `eta: string` ("가게가 확인 중", "곧 출발해요", "8분 남았어요"), `steps: readonly string[]` (주문 현황 화면과 같은 네 단계 이름), `current: number` (1부터), `onPress: () => void`

## 하네스 상태
`ActiveOrderCard.stories.tsx`에 아래를 전부 만든다.
- 주문 접수 (`Accepted`), 조리 중 (`Cooking`), 배달 중 (`Delivering`, 시안 기본)
- 긴 메뉴 이름 말줄임 (`LongMenu`)

## 쓰는 화면
Main

## 테스트 기준
- 버튼 하나, 이름은 시안대로 "진행 중인 주문: 돼지국밥 배달 중, 8분 남았어요" (안의 글자와 막대는 읽지 않는다)
- 단계 막대는 current까지 채운다 (base `StepProgress` sm)
- 누르면 onPress 한 번
- 시안 값: 흰 바탕, 테두리 1.5 `--theme-accent`, 모서리 16, 여백 12 12 12 14, 사이 12, 최소 높이 44. 왼쪽 36 원(테마 색)에 흰 스쿠터 20, 제목 14/600, 시간 13/600 테마 색, 오른쪽 화살표 18 `ink-secondary`

## 메모
- 막대는 base `StepProgress` sm(4px)이다. 시안 칸 사이는 3인데 StepProgress는 4라 1px 다르다 (같은 부품을 쓰려고 둔다).
- 스쿠터는 base `Icon` `scooter`(Main 시안 경로)다.
- 시안의 카드 위 여백 10은 이 부품이 아니라 `ChatLayout` top 띠의 사이(10)다.
