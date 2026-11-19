---
node: leaf
parent: _index.md
children: []
---

# ChatHeader

`packages/ui/src/chat/ChatHeader/`

## 책임
대화 화면 맨 위 줄(용이, 이름, 레벨 한 줄, 설정 버튼)을 그린다.

## 책임 아님
레벨 문구 만들기 (부모가 formatOkrw로 만든 문장을 넘긴다), 설정 화면 열기 (`onSettings`), 줄 바깥 여백 (`ChatLayout`)

## props
`name: string`, `caption: string` ("레벨 1, 한 번에 10,000원까지"), `species: DragonSpecies`, `mood?: DragonMood` (기본 `default`), `onSettings?: () => void` (없으면 설정 버튼도 없다)

## 하네스 상태
`ChatHeader.stories.tsx`에 아래를 전부 만든다.
- 설정 버튼 있음 (`WithSettings`, Main 시안)
- 설정 버튼 없음 (`NoSettings`, LimitChat 시안)
- 긴 이름과 좁은 폭 (`LongCaption`)

## 쓰는 화면
Main, LimitChat

## 테스트 기준
- 44px 용이(받은 종과 표정), 이름이 h1, 그 뒤 한 줄
- 설정 버튼 이름은 "<이름> 설정", 누르면 onSettings 한 번. onSettings가 없으면 버튼 없음
- 시안 값 (간격 12, 이름 18/700 `type.heading`, 한 줄 13px `ink-secondary`, 둘 사이 2)

## 메모
- 설정 버튼은 base `IconButton` `more`(점 세 개, 선 1.8)다.
- 대화 화면에 다른 제목이 없어 이름을 화면 제목(h1)으로 둔다. 시안은 `div`다.
- 이름과 한 줄 사이 2px은 4 단위 간격 토큰이 없어 리터럴이다.
- 레벨 3 날개(`Dragon` `wings`)는 아직 넘기지 않는다. 레벨이 화면에 생길 때 props를 늘린다.
