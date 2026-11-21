---
node: leaf
parent: _index.md
children: []
---

# RetryLine

`packages/ui/src/base/RetryLine/`

## 책임
읽기가 실패했을 때 오류 한 줄(`ErrorLine`)과 그 아래 "다시 불러오기" 누름(`Button` link, sm)을 왼쪽 정렬로 묶어 그린다. 주문 현황, 주문 상세, 한도 막대가 같은 모양을 쓴다 (QA 4차).

## 책임 아님
언제 보일지 (부모가 질의가 실패했을 때만 그린다), 다시 묻는 일(부모가 refetch를 넘긴다), 문구 정하기

## props
`children: string` (한 줄), `onRetry: () => void`, `retryLabel?: string` (기본 "다시 불러오기")

## 하네스 상태
`RetryLine.stories.tsx`에 `Default`, `CustomLabel`을 만든다.

## 쓰는 화면
Order status, Receipt, Main(한도 막대)

## 테스트 기준
- 한 줄이 role alert, 그 아래 "다시 불러오기" 버튼
- 누르면 onRetry 한 번, 라벨을 바꿀 수 있다

## 메모
- 첫 진입 Splash의 실패 상태는 테마색 바탕 위라 별도다 (Splash `onRetry`).
