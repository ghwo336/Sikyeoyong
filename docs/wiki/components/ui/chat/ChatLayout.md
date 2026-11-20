---
node: leaf
parent: _index.md
children: []
---

# ChatLayout

`packages/ui/src/chat/ChatLayout/`

## 책임
대화 화면의 띠(위 줄, 예산 카드, 대화, 입력칸)를 시안 여백으로 위에서 아래로 배치한다.

## 책임 아님
각 띠의 그림 (`ChatHeader`, `Meter`, `ChatThread`, `ChatInput`을 넘긴다), 스크롤 (`ChatThread`), 화면 폭과 높이 (화면 틀 `.screen`)

## props
`header?: ReactNode` (위 줄), `top?: ReactNode` (위 줄 아래, Main 예산 카드와 진행 중인 주문 카드. 여럿이면 세로로 10 간격), `children: ReactNode` (대화, 남은 높이를 차지한다), `footer: ReactNode` (입력칸)

## 하네스 상태
`ChatLayout.stories.tsx`에 아래를 전부 만든다.
- 위 줄, 예산 카드, 대화, 입력칸 (`Main`, Main 시안)
- 예산 카드 없음 (`NoTop`, LimitChat 시안)

## 쓰는 화면
Main, LimitChat

## 테스트 기준
- 위 줄, 예산, 대화, 입력칸 순서. 대화는 감싸지 않는다 (ChatThread가 남은 높이를 차지)
- header나 top이 없거나 null이면 그 띠를 그리지 않는다
- top 띠 안은 세로 줄, 사이 10(`size.summaryGap`, Main 시안의 주문 카드 위 10)
- 시안 여백: 위 줄 16 20 12, 예산 0 20, 입력칸 10 16 24(`size.inputBandTop`)에 바탕 `--theme-bg`(종별 화면 바탕, D-32. 숲이면 `ground`와 같다). 전체는 남은 높이를 채우는 세로 줄

## 메모
- ChatInput.md의 "화면 아래 띠(여백 10 16 24)"를 여기서 그린다 (2026-11-19, web.md "ui에 없는 것" 해결).
- 대화 띠 여백(Main 20 20 12)은 ChatThread가 가진다. LimitChat 시안은 16 20 12라 다르다 (LimitChat 조립 때 정한다).
- 확인 시트(`OrderConfirmSheet`)는 띠가 아니라 화면 위에 뜨므로 이 배치 밖에 둔다.
