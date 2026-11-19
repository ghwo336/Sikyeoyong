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
`pocket: bigint`, `onRefund`, `onWake`, `refunding?`

## 하네스 상태
`FrozenPanel.stories.tsx`에 아래를 전부 만든다.
- 기본
- 주머니 0
- 돌려받는 중

## 쓰는 화면
Frozen

## 테스트 기준
- pocket이 0이면 돌려받기 숨김

## 메모
없음
