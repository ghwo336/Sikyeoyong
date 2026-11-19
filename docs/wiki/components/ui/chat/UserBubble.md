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
`text: string`, `status?: 'sending' | 'sent' | 'failed'` (기본 `sent`), `onRetry?: () => void`

## 하네스 상태
`UserBubble.stories.tsx`에 아래를 전부 만든다.
- 보냄 (`Sent`)
- 보내는 중 (`Sending`)
- 실패와 다시 보내기 (`Failed`)

## 쓰는 화면
Main, LimitChat

## 테스트 기준
- failed일 때만 "다시 보내기" 버튼, 누르면 onRetry 한 번. onRetry가 없으면 "못 보냈어요"만
- 보내는 중은 aria-busy와 "보내는 중" 글씨, 말풍선은 흐리게 하지 않는다
- 한글 keep-all
- 줄바꿈과 앞뒤 공백을 그대로 보인다
- Main 시안 값 (오른쪽, 최대 260, 여백 11 16, 모서리 20 20 6 20, 잎색 바탕 흰 15px, 줄간격 1.5)

## 메모
- 시안에는 보내는 중과 실패 모양이 없다. 보내는 중은 말풍선 아래 13px `ink-secondary` "보내는 중"(말풍선을 흐리게 하면 흰 글씨 대비가 4.5:1 아래로 떨어져서), 실패는 아래에 13px 호박 글씨 "못 보냈어요"와 잎색 "다시 보내기"(높이 44) (추론. 화면 조립 때 시안과 다시 맞춘다).
- 한글은 `word-break: keep-all`, 끊을 곳 없는 긴 글자는 `overflow-wrap: anywhere`.
- LimitChat 시안의 말풍선 최대 폭은 270이라 Main(260)과 다르다. 260으로 통일했다 (추론).
- 시안 말풍선에는 자간이 없어 `type.bubble`에도 두지 않았다.
- `type.bubble`(15/400, 1.5), `size.bubbleMax`(260), `size.bubblePadY`(11) 토큰을 쓴다.
