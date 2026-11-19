---
node: leaf
parent: _index.md
children: []
---

# UserBubble

`packages/ui/src/chat/UserBubble/`

## 책임
사용자가 한 말을 오른쪽 말풍선으로 그린다.

## 책임 아님
전송

## props
`text`, `status?: 'sending' | 'sent' | 'failed'`, `onRetry?`

## 하네스 상태
`UserBubble.stories.tsx`에 아래를 전부 만든다.
- 보냄
- 보내는 중
- 실패와 다시 보내기

## 쓰는 화면
Main, LimitChat

## 테스트 기준
- failed일 때만 onRetry 버튼

## 메모
없음
