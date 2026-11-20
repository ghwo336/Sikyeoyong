---
node: leaf
parent: _index.md
children: []
---

# TypingIndicator

`packages/ui/src/chat/TypingIndicator/`

## 책임
용이가 답을 쓰는 동안 대화 줄에 작은 용이와 점 세 개를 그린다 (D-23: 느린 답도 채팅처럼).

## 책임 아님
언제 보일지 정하기 (웹 대화 컨테이너가 보낸 뒤 첫 글자나 카드가 오기 전까지 그린다)

## props
`species: DragonSpecies`

## 하네스 상태
`TypingIndicator.stories.tsx`에 아래를 전부 만든다.
- 기본 (`Default`, 숲)
- 물 (`Water`)

## 쓰는 화면
Main (대화)

## 테스트 기준
- `role="status"`, 이름 "용이가 답을 쓰고 있어요"(화면 읽기 프로그램용)
- 용이 32px(Main 대화 줄과 같은 크기), 점 셋, 사이 `size.dragonChatGap`
- 점은 `motion.typing`(1200ms) 동안 차례로 옅어졌다 짙어지고, 동작 줄이기 설정이면 멈춘 채 반쯤 보인다

## 메모
- 시안에는 없다. 실기기에서 답이 늦게 와 멈춘 화면처럼 보인다는 지적으로 더했다 (2026-11-20). 다음 시안 갱신 때 Main에 넣는다.
