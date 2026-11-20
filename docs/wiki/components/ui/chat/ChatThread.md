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
`children: ReactNode`, `autoScroll?: boolean` (기본 true), `stamp?: string` (맨 위 시각 "오늘 오후 12:28"), `streaming?: boolean` (용이가 답을 쓰는 중, aria-busy), `followKey?: string` (사용자가 보낸 마지막 메시지 id. 바뀌면 맨 아래로)

## 하네스 상태
`ChatThread.stories.tsx`에 아래를 전부 만든다.
- 짧은 대화 (`Short`, Main 시안)
- 긴 대화 스크롤 (`Long`)
- 스트리밍 중 (`StreamingAnswer`, 답이 한 글자씩 늘어남)

## 쓰는 화면
Main, LimitChat

## 테스트 기준
- 옆에 회색 스크롤바가 보이지 않는다 (`scrollbar-width: none`과 webkit 스크롤바 숨김, D-23 앱처럼)
- 스크롤하는 줄 안의 메시지는 줄어들지 않는다 (`.thread > *` flex-shrink 0. 카드는 넘침을 숨겨 줄어들면 잘린다, 2026-11-20 실기기에서 발견)
- 새 메시지에 자동 스크롤, 사용자가 위로 올렸으면 멈춤, 맨 아래 24px 안으로 돌아오면 다시 따라감 (`isNearBottom`)
- 위로 올려 읽다가 사용자가 메시지를 보내면(`followKey`가 바뀜) 맨 아래로 바로 내려가고 다시 따라감. 메신저처럼 부드러운 스크롤 대신 즉시 이동 (부드러운 스크롤 도중 스크롤 이벤트가 따라가기를 끊지 않게)
- 스트리밍으로 마지막 메시지가 길어져도 따라감
- autoScroll이 꺼지면 스크롤하지 않음
- role log, aria-live polite, 스트리밍 중에만 aria-busy
- Main 시안 값 (간격 16, 여백 20 20 12, 시각 12px `ink-secondary` 가운데)

## 메모
- 스크롤은 렌더마다 확인한다 (useLayoutEffect). 그래서 글자가 늘어나는 스트리밍도 따라간다.
- LimitChat 시안은 위 여백이 16이다 (Main은 20). 20으로 통일했다 (추론).
- `type.stamp`(12/400) 토큰을 쓴다.
