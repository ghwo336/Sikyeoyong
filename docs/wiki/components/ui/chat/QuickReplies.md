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
`items: readonly { id: string; label: string }[]`, `onPick: (id: string) => void`

## 하네스 상태
`QuickReplies.stories.tsx`에 아래를 전부 만든다.
- 두 개 (`Two`, Main 시안)
- 넘칠 때 줄바꿈 (`Wrapping`)

## 쓰는 화면
Main

## 테스트 기준
- onPick에 id 전달 (한 번 누르면 한 번)
- 항목마다 Chip sm 버튼 하나, 순서 그대로, "빠른 답장" 묶음 안. 고르기(radio)가 아니다
- 항목이 없으면 그리지 않음
- Main 시안 값 (줄바꿈, 간격 8, 왼쪽 들여쓰기 32 + 10으로 드래곤 말과 맞춤)
- 칩은 sm 클래스만 (lg, tile 아님)
- `size.dragonChat`이 DragonLine chat 용이 크기와 같다 (어긋나면 들여쓰기가 틀어진다)

## 메모
- 칩 모양은 base `Chip`의 `sm`이다. 들여쓰기는 `size.dragonChat`(32)과 `size.dragonChatGap`(10).
