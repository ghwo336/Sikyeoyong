---
node: leaf
parent: _index.md
children: []
---

# ChatThread

`packages/ui/src/chat/ChatThread/`

## 책임
대화 메시지 목록을 위에서 아래로 쌓고 새 메시지에 스크롤한다.

## 책임 아님
메시지 종류별 그림 (자식 컴포넌트가 그림)

## props
`children`, `autoScroll?: boolean`

## 하네스 상태
`ChatThread.stories.tsx`에 아래를 전부 만든다.
- 짧은 대화
- 긴 대화 스크롤
- 스트리밍 중

## 쓰는 화면
Main, LimitChat

## 테스트 기준
- 새 메시지에 자동 스크롤, 사용자가 위로 올렸으면 멈춤

## 메모
없음
