---
node: leaf
parent: _index.md
children: []
---

# Egg

`packages/ui/src/dragon/Egg/`

## 책임
알을 그린다 (닫힌 알, 흔들리는 알, 자는 알).

## 책임 아님
부화 진행 판단

## props
`state: 'closed' | 'wobble' | 'sleeping'`, `species: DragonSpecies` (타입은 `packages/shared`), `size: number` (가로세로 px. 시안 도감 120, Frozen 168)

## 하네스 상태
`Egg.stories.tsx`에 아래를 전부 만든다.
- 닫힘
- 흔들림(움직임)
- 잠듦 Zz
- 종 4가지 무늬 (잎 점, 물결, 꽃잎 점, 별과 달)

## 쓰는 화면
Start, Name, Hatch, Frozen

## 테스트 기준
- reduced motion이면 흔들림 없음

## 메모
알 무늬 기준은 `design/screens/Dragons.dc.html` (D-20). 흔들림은 Motion으로 아래 중심을 축 삼아 회전(transform만), 동작 줄이기면 흔들지 않는다(`useShouldReduceMotion`). 하네스에는 문서 상태 네 개와 "동작 줄이기에서 흔들림"이 있다.
