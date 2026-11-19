---
node: leaf
parent: _index.md
children: []
---

# DragonLine

`packages/ui/src/dragon/DragonLine/`

## 책임
드래곤 한 줄 말을 고운돋움으로 그린다 (옆에 작은 드래곤).

## 책임 아님
말 내용 만들기 (서버나 템플릿이 줌)

## props
`text`, `mood?`, `layout: 'inline' | 'center'`

## 하네스 상태
`DragonLine.stories.tsx`에 아래를 전부 만든다.
- 한 줄
- 두 줄
- 가운데 정렬
- 아바타 없음

## 쓰는 화면
Main, Done, Tracking, Blocked, Cap

## 테스트 기준
- 두 줄 넘으면 말줄임 없이 그대로 (문구 쪽 문제로 본다)

## 메모
없음
