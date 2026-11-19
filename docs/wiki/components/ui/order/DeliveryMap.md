---
node: leaf
parent: _index.md
children: []
---

# DeliveryMap

`packages/ui/src/order/DeliveryMap/`

## 책임
가게에서 집까지 경로와 라이더 위치를 그린다.

## 책임 아님
위치 받아 오기 (props로 받음)

## props
`store: Point`, `home: Point`, `rider?: Point`, `route: readonly Point[]`, `progress: number` (0~1, 밖이면 자름), `storeName: string`, `homeName: string`. Point는 390×400 그림 좌표

## 하네스 상태
`DeliveryMap.stories.tsx`에 아래를 전부 만든다.
- 출발 직후 (`JustLeft`)
- 절반 (`Halfway`, Tracking 시안 경로)
- 거의 도착 (`AlmostThere`)
- 라이더 위치 없음(1단계 목) (`NoRider`)

## 쓰는 화면
Tracking

## 테스트 기준
- 지난 길 실선, 남은 길 점선 (점선은 길 전체, 실선은 progress까지 위에 겹침). progress 0이면 실선 없음
- 경로 자르기 (`splitRoute`): 모서리에서 멈추면 길이 0 조각을 만들지 않음, 0~1 밖과 NaN은 자름
- role=img와 설명: 라이더가 있으면 "라이더가 {가게}에서 {집}(으)로 오는 경로 지도", 없으면 "{가게}에서 {집}까지 경로 지도". 로/으로는 받침으로 고름 (ㄹ 받침은 로)
- 라이더 표시는 위치가 있을 때만, 가게와 집 핀과 이름은 받은 자리에
- Tracking 시안 색 (`mapGround`, `mapBlock`, `mapPark`, 경로와 라이더 잎색, 그릇 노른자, 핀 ink)

## 메모
1단계는 그림 지도(목). 2단계에 실제 지도 SDK로 바꿔도 props는 그대로 둔다.
- 건물과 길 배경은 Tracking 시안 그림을 그대로 쓴 장식이다. 좌표는 그 그림 기준이다.
- 지도 위 "대화로 돌아가기" 떠 있는 버튼은 Tracking 화면이 그린다.
