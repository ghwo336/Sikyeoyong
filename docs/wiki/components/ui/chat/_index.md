---
node: internal
parent: ../_index.md
children:
  - UserBubble.md
  - ChatInput.md
  - QuickReplies.md
  - ChatThread.md
  - ChatHeader.md
  - ChatLayout.md
  - TypingIndicator.md
  - SessionDivider.md
  - PastLine.md
---

# 대화 (chat)

대화 화면 부품. 말풍선, 드래곤 한 줄, 입력창.

영역 사이 import는 `base`와 `dragon`만 허용한다 (`conventions/architecture.md`).

| 컴포넌트 | 책임 |
| --- | --- |
| [UserBubble](UserBubble.md) | 사용자가 한 말을 오른쪽 말풍선으로 그린다. |
| [ChatInput](ChatInput.md) | 대화 입력칸과 보내기 버튼을 그린다. |
| [QuickReplies](QuickReplies.md) | 빠른 답장 칩 묶음을 그린다. |
| [TypingIndicator](TypingIndicator.md) | 용이가 답을 쓰는 동안 작은 용이와 점 세 개를 그린다. |
| [ChatThread](ChatThread.md) | 대화 메시지 목록을 위에서 아래로 쌓고 새 메시지에 스크롤한다. |
| [ChatHeader](ChatHeader.md) | 대화 화면 맨 위 줄(용이, 이름, 한도 한 줄, 설정 버튼)을 그린다. |
| [ChatLayout](ChatLayout.md) | 대화 화면의 띠(위 줄, 예산, 대화, 입력칸)를 시안 여백으로 배치한다. |
| [SessionDivider](SessionDivider.md) | 지난 대화 위에 날짜와 끼니 한 줄을 그린다. |
| [PastLine](PastLine.md) | 지난 대화의 카드를 버튼 없는 한 줄 요약으로 그린다. |
