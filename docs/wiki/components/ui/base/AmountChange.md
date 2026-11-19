---
node: leaf
parent: _index.md
children: []
---

# AmountChange

`packages/ui/src/base/AmountChange/`

## 책임
한 금액의 전과 후를 "전(취소선) 화살표 후(크게)"로 그리고, 화면 읽기에는 "A에서 B으로"로 읽힌다.

## 책임 아님
바꾸기 (부모가 버튼으로), 금액 계산, 무엇의 금액인지 이름 (부모가 위에 그린다)

## props
`from: bigint` (aokrw 전), `to: bigint` (aokrw 후), `animate?: boolean` (후 금액을 굴리기, 기본 false)

## 하네스 상태
`AmountChange.stories.tsx`에 아래를 전부 만든다.
- 올리기 (`Raise`)
- 내리기 (`Lower`)
- 아주 큰 금액 (`Huge`)

## 쓰는 화면
LimitChat(`LimitChangeCard`)

## 테스트 기준
- "A에서 B으로"로 읽힌다, 두 금액 모두 formatOkrw
- 전은 `<s>`, 후는 `<b>`
- 화살표는 base `Icon` arrow-right, 화면 읽기에 숨김
- Number를 넘는 금액도 정확히
- LimitChat 시안 값 (전 15px `ink-muted`, 화살표 `size.arrowIcon`, 후 22/700, 간격 8)

## 메모
- 2026-11-19 재사용 감사(D-18 원칙 5)로 LimitChangeCard 안의 전후 금액 마크업을 뽑았다. 금액 글자는 base `Amount`(`size="inherit"`)로 그려서 formatOkrw와 고정폭 숫자, 굴리기를 Amount와 공유한다.
- OrderConfirmSheet의 가격 변경 알림("가격이 A에서 B으로 바뀌었어요")은 문장이라 ErrorLine 글자로 두고 이 부품을 쓰지 않는다 (판단).
