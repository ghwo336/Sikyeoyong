---
node: leaf
parent: _index.md
children: []
---

# ChatInput

`packages/ui/src/chat/ChatInput/`

## 책임
대화 입력칸과 보내기 버튼을 그린다.

## 책임 아님
메시지 전송 (onSend 콜백)

## props
`value`, `onChange`, `onSend`, `placeholder`, `disabled?`

## 하네스 상태
`ChatInput.stories.tsx`에 아래를 전부 만든다.
- 빈 칸
- 입력됨
- 보내는 중
- 멈춤 상태라 비활성 안내

## 쓰는 화면
Main, LimitChat

## 테스트 기준
- 빈 값이면 onSend 안 부름
- Enter로 전송

## 메모
없음
