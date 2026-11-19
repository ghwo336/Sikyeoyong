---
node: leaf
parent: _index.md
children: []
---

# QuickReplies

`packages/ui/src/chat/QuickReplies/`

## 책임
빠른 답장 칩 묶음을 그린다.

## 책임 아님
답장 내용 만들기

## props
`items: { id, label }[]`, `onPick(id)`

## 하네스 상태
`QuickReplies.stories.tsx`에 아래를 전부 만든다.
- 두 개
- 넘칠 때 줄바꿈

## 쓰는 화면
Main

## 테스트 기준
- onPick에 id 전달

## 메모
없음
