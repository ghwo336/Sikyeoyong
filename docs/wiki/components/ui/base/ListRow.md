---
node: leaf
parent: _index.md
children: []
---

# ListRow

`packages/ui/src/base/ListRow/`

## 책임
설정 화면의 한 줄(이름, 값, 화살표 또는 스위치)을 그린다.

## 책임 아님
값 계산

## props
`label`, `value?`, `trailing?: 'chevron' | ReactNode`, `onPress?`

## 하네스 상태
`ListRow.stories.tsx`에 아래를 전부 만든다.
- 값만
- 화살표
- 스위치
- 강조 값(잎색)

## 쓰는 화면
Wallet, Receipt

## 테스트 기준
- onPress 있으면 button, 없으면 div

## 메모
없음
