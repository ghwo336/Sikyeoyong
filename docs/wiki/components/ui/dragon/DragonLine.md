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
`text: string` (줄바꿈 `\n`이면 두 줄), `mood?: DragonMood` (기본 `default`), `layout: 'chat' | 'inline' | 'sheet' | 'center'`, `species: DragonSpecies` (옆 용이의 종, D-20), `avatar?: boolean` (기본 true)

## 하네스 상태
`DragonLine.stories.tsx`에 아래를 전부 만든다.
- 한 줄
- 두 줄
- 가운데 정렬
- 대화 (Main)
- 시트 (Confirm)
- 아바타 없음

## 쓰는 화면
Main, Done, Tracking, Blocked, Cap

## 테스트 기준
- 두 줄 넘으면 말줄임 없이 그대로 (문구 쪽 문제로 본다)

## 메모
- chat은 Main 시안: 용이 32px 옆에 17px, 줄간격 1.6(`type.body` 줄간격), 위쪽 정렬, 글자 2px 내림, 간격 10(`size.dragonChatGap`).
- inline은 Done 시안: 용이 56px 옆에 17px(`type.dragon`), 간격 12. sheet는 Confirm 시안: 용이 44px(`size.dragonSheet`) 옆에 18px 줄간격 1.5(`type.dragonSheet`), 간격 12. center는 Cap, Blocked 시안: 용이 128px 위에 19px(`type.dragonLarge`, 2026-11-19 시안에서 옮겨 적음), 간격 16, 가운데 정렬.
- 말줄임과 줄 수 제한을 두지 않는다. 길면 문구를 고친다.
- Tracking 시안의 용이는 52px이다. Dragon 크기 목록에 52가 없어 inline(56)으로 그린다.
