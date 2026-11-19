---
node: leaf
parent: _index.md
children: []
---

# ActionPair

`packages/ui/src/base/ActionPair/`

## 책임
주 버튼 하나와 그 아래 물러나는 버튼 하나를 화면 시안 간격으로 세로로 쌓는다.

## 책임 아님
버튼 모양과 누르기 (각 자리에 base `Button`을 넘긴다), 두 번 눌림 잠금 (`useSubmitLock`), 무엇을 할지

## props
`primary?: ReactNode` (주 버튼, 없으면 물러나는 버튼만), `secondary: ReactNode` ("다시 고를래", "그만두기"), `gap: 'xs' | 'sm' | 'md'` (4 Confirm, 6 LimitChat, 8 Cap과 Blocked)

## 하네스 상태
`ActionPair.stories.tsx`에 아래를 전부 만든다.
- 확인 시트 (`Confirm`, xs)
- 한도 바꾸기 카드 (`LimitChange`, sm)
- 주 버튼 없음 (`SecondaryOnly`, md)

## 쓰는 화면
Confirm(`OrderConfirmSheet`), Cap(`CapReached`), Blocked(`LimitBlocked`), LimitChat(`LimitChangeCard`)

## 테스트 기준
- 주 버튼이 먼저, 그다음 물러나는 버튼
- 주 버튼이 없으면 하나만
- gap 클래스가 붙는다
- 시안 값 (세로, 4, 6, 8)

## 메모
- 2026-11-19 재사용 감사(D-18 원칙 5)로 네 컴포넌트에 따로 있던 `.actions` 묶음을 모았다. 버튼 자체는 이미 base Button이라 이 부품은 배치만 맡는다.
- 6은 4px 간격 눈금에 없어서 LimitChat 시안 값을 리터럴로 둔다.
