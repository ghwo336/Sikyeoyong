---
node: leaf
parent: _index.md
children: []
---

# FrozenPanel

`packages/ui/src/wallet/FrozenPanel/`

## 책임
용이가 자는 화면(알 속 Zz)과 돌려받기, 깨우기 버튼을 그린다.

## 책임 아님
동결 해제와 회수 실행

## props
`pocket: bigint` (aokrw), `species: DragonSpecies` (자는 알, D-20), `onRefund: () => void`, `onWake: () => void`, `refunding?: boolean`

## 하네스 상태
`FrozenPanel.stories.tsx`에 아래를 전부 만든다.
- 기본 (`Default`, Frozen 시안)
- 주머니 0 (`EmptyPocket`)
- 돌려받는 중 (`Refunding`)

## 쓰는 화면
Frozen

## 테스트 기준
- pocket이 0이면 돌려받기 숨김 ("0원 남음"은 보임)
- 돌려받기는 한 번, 돌려받는 중이면 다시 안 됨 (aria-busy)
- 용이 깨우기는 onWake 한 번
- 그 종의 자는 알(Zz)을 168로
- 시안 문구 "용이가 자고 있어요", "모든 주문이 멈췄어요", 주머니는 formatOkrw
- Frozen 시안 값 (알과 글 사이 22, 두 줄 사이 6, 제목 26/700, 주머니 줄 위 선 `sleepLine`과 여백 18, 돌려받기 44 알약 ink 테두리 여백 18)

## 메모
- 돌려받기는 돈이 움직이는 일이라 이 버튼으로만 부모가 한다 (CLAUDE.md 절대 규칙 3).
- 화면 바탕 `sleepGround`와 위 뒤로 버튼은 Frozen 화면이 그린다.
- 깨우기 버튼은 base `Button` primary. 돌려받기는 ink 테두리 알약이라 이 컴포넌트 CSS로 그린다.
