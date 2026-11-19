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
`store: Point`, `home: Point`, `rider?: Point`, `route: Point[]`, `progress: number`

## 하네스 상태
`DeliveryMap.stories.tsx`에 아래를 전부 만든다.
- 출발 직후
- 절반
- 거의 도착
- 라이더 위치 없음(1단계 목)

## 쓰는 화면
Tracking

## 테스트 기준
- 지난 길 실선, 남은 길 점선
- role=img와 설명

## 메모
1단계는 그림 지도(목). 2단계에 실제 지도 SDK로 바꿔도 props는 그대로 둔다.
