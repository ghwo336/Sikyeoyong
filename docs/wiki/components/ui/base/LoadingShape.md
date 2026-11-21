---
node: leaf
parent: _index.md
children: []
---

# LoadingShape

`packages/ui/src/base/LoadingShape/`

## 책임
데이터를 불러오는 동안 한 영역의 실제 모양(높이, 테두리, 간격)과 같은 멈춰 있는 회색 뼈대를 그린다. 데이터가 오면 자리가 밀리지 않는다 (D-23).

## 책임 아님
불러오는 중 알리기 (부모가 `aria-busy`), 언제 보일지 (부모), 막대 하나 그리기 (`Skeleton`)

## props
`kind: 'chatHeader' | 'meter' | 'orderStatus' | 'rows' | 'detail'`, `count?: number` (`rows`의 줄 수, 기본 3), `data-*`

## 하네스 상태
`LoadingShape.stories.tsx`에 `ChatHeader`, `Meter`, `OrderStatus`, `Rows`, `Detail`을 만든다.

## 쓰는 화면
Main(헤더, 30일 배달비), 주문 현황, 주문 상세, 용이 용돈, 신분증, 한도 화면

## 테스트 기준
- 종류마다 화면 읽기에 숨김, `data-shape`, 회색 막대를 그린다
- `rows`는 줄 수만큼
- 움직이지 않는다 (애니메이션, 전환 없음)

## 메모
- 모양 크기는 ChatHeader(44), Meter framed, ListRow(터치 44)와 맞춘다. 이 부품이 바뀌면 같이 고친다.
- `orderStatus`와 `detail`의 블록 높이는 실제 부품 CSS와 같은 토큰으로 계산한다 (리터럴 px 없음). 토큰이 실제 CSS에 있는지 테스트가 읽어 확인한다
