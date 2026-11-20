---
node: leaf
parent: _index.md
children: []
---

# ChatHeader

`packages/ui/src/chat/ChatHeader/`

## 책임
대화 화면 맨 위 줄(용이, 이름, 한도 한 줄, 주문 내역 버튼, 설정 버튼)을 그린다.

## 책임 아님
한도 문구 만들기 (부모가 formatOkrw로 만든 문장을 넘긴다), 설정 화면과 주문 내역 열기 (`onSettings`, `onHistory`), 줄 바깥 여백 (`ChatLayout`)

## props
`name: string`, `caption: string` ("한 번에 10,000원까지", Main 시안), `species: DragonSpecies`, `mood?: DragonMood` (기본 `default`), `onHistory?: () => void` (주문 내역 영수증 버튼, 없으면 버튼도 없다, 2026-11-20 Main 시안), `onSettings?: () => void` (없으면 설정 버튼도 없다)

## 하네스 상태
`ChatHeader.stories.tsx`에 아래를 전부 만든다.
- 주문 내역과 설정 버튼 (`WithSettings`, Main 시안)
- 설정 버튼만 (`SettingsOnly`)
- 설정 버튼 없음 (`NoSettings`, LimitChat 시안)
- 긴 이름과 좁은 폭 (`LongCaption`)

## 쓰는 화면
Main, LimitChat

## 테스트 기준
- 44px 용이(받은 종과 표정), 이름이 h1, 그 뒤 한 줄
- 설정 버튼 이름은 "<이름> 설정", 누르면 onSettings 한 번. onSettings가 없으면 버튼 없음
- 주문 내역 버튼 이름은 "주문 내역"(아이콘 `receipt`), 설정보다 앞, 누르면 onHistory 한 번
- 시안 값 (간격 8, 용이와 글자 사이는 4를 더해 12, 이름 18/700 `type.heading`, 한 줄 13px `ink-secondary`, 둘 사이 2)

## 메모
- Main 시안의 위 줄 오른쪽 여백은 12인데 `ChatLayout` header 띠는 20(LimitChat 시안)이다. 버튼 상자(44)가 아이콘 둘레를 비워 두어 눈으로는 거의 같아 그대로 둔다.
- 설정 버튼은 base `IconButton` `more`(점 세 개, 선 1.8)다.
- 대화 화면에 다른 제목이 없어 이름을 화면 제목(h1)으로 둔다. 시안은 `div`다.
- 이름과 한 줄 사이 2px은 4 단위 간격 토큰이 없어 리터럴이다.
- 3단계 날개(`Dragon` `wings`, shared `dragonStage`, D-31)는 아직 넘기지 않는다. 대화 화면에 자란 모습이 필요해지면 props를 늘린다.
