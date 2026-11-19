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
`state: 'closed' | 'wobble' | 'sleeping'`, `species: DragonSpecies`, `size`

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
알 무늬 기준은 `design/screens/Dragons.dc.html` (D-20).
