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
`text: string` (줄바꿈 `\n`이면 두 줄), `mood?: DragonMood` (기본 `default`), `layout: 'chat' | 'inline' | 'sheet' | 'center' | 'greeting'`, `species: DragonSpecies` (옆 용이의 종, D-20), `avatar?: boolean` (기본 true), `stage?: DragonStage` (`1 | 2 | 3`, shared `dragonStage`로 구한 자란 정도. 3이면 어느 배치든 날개, greeting이면 용이가 80, 92, 104로 자란다. 없으면 예전 그대로), `children?: ReactNode` (용이가 말과 함께 건네는 것. 말 아래 같은 칸에 간격 12로 붙는다. Main 추천 카드)

## 하네스 상태
`DragonLine.stories.tsx`에 아래를 전부 만든다.
- 한 줄
- 두 줄
- 가운데 정렬
- 대화 (Main)
- 시트 (Confirm)
- 아바타 없음
- 가입 인사 (`Greeting`, Budget 시안)
- 자라는 용이 (`GreetingGrows`, Budget 시안, 1, 2, 3단계)
- 말 아래 카드 (`ChatWithCard`, Main 시안)

## 쓰는 화면
Main, Budget, Done, Tracking, Confirm, Blocked, Cap

## 테스트 기준
- 두 줄 넘으면 말줄임 없이 그대로 (문구 쪽 문제로 본다)
- children이 있으면 용이 옆 한 칸에 말이 먼저, children이 그 아래 (간격 12, 줄 바꿈 가능하게 min-width 0). 없거나 비어 있으면(undefined, null, false, 빈 문자열: `{cond && <X />}`가 남기는 값) 말이 바로 용이 옆
- 배치별 용이 크기와 글자 (chat 32/17, inline 56/17, sheet 44/18, center 128/19, greeting 96/20)
- greeting에 stage를 주면 용이를 104로 그리고 104 칸 안에서 transform scale로 80(1), 92(2), 104(3)가 된다. 3단계만 날개. 크기 변화는 transform 240ms만(width, height 애니메이션 없음), 동작 줄이기면 바로 바뀐다
- greeting 밖에서는 stage가 크기를 바꾸지 않고 3단계 날개만 붙인다

## 메모
- chat은 Main 시안: 용이 32px 옆에 17px, 줄간격 1.6(`type.body` 줄간격), 위쪽 정렬, 글자 2px 내림, 간격 10(`size.dragonChatGap`).
- inline은 Done 시안: 용이 56px 옆에 17px(`type.dragon`), 간격 12. sheet는 Confirm 시안: 용이 44px(`size.dragonSheet`) 옆에 18px 줄간격 1.5(`type.dragonSheet`), 간격 12. center는 Cap, Blocked 시안: 용이 128px 위에 19px(`type.dragonLarge`, 2026-11-19 시안에서 옮겨 적음), 간격 16, 가운데 정렬.
- greeting은 Budget 시안: 용이 96px 옆에 20px 줄간격 1.5(`type.dragonGreeting`), 간격 14(`size.dragonGreetingGap`), 가운데 정렬. 2026-11-19 시안에서 tokens.json으로 옮겨 적었다.
- children 자리는 Main 시안처럼 추천 카드가 화면 끝이 아니라 말과 같은 줄(32 + 10 들여쓰기)에 서게 하려고 2026-11-19에 늘렸다. 무엇을 넣을지는 부모가 정한다 (chat 영역 밖 order 카드도 웹이 조립한다).
- 줄바꿈은 base `lines`(ScreenTitle과 같이 쓴다)로 그린다.
- 말줄임과 줄 수 제한을 두지 않는다. 길면 문구를 고친다.
- Tracking 시안의 용이는 52px이다. Dragon 크기 목록에 52가 없어 inline(56)으로 그린다.
- 자라는 용이(`stage`)는 2026-11-20 D-31 Budget 시안에서 왔다. 시안은 svg width와 height를 240ms로 바꾸지만 design-and-motion.md는 레이아웃 속성 애니메이션을 막으므로, 104 칸을 고정하고 transform으로 줄인다. 그래서 1단계일 때 말 글자가 시안보다 12 오른쪽에 있다 (대신 + 를 눌러도 글자가 움직이지 않는다). 시안과 다르니 디자인 확인 대상이다.
