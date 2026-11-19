---
node: leaf
parent: _index.md
children: []
---

# useSubmitLock

`packages/ui/src/base/useSubmitLock/`

## 책임
제출 콜백을 감싸서 두 번 눌러도 한 번만 부르게 하는 훅. 모양은 없다.

## 책임 아님
무엇을 제출할지, 바쁨 상태 관리 (부모가 `busy`를 올리고 내린다), 버튼 모양 (Button)

## props
`useSubmitLock(busy: boolean, action: () => void): () => void`. 돌려받은 함수를 버튼 `onPress`에 넘긴다.

## 하네스 상태
`useSubmitLock.stories.tsx`에 아래를 전부 만든다. 훅이라 버튼과 호출 횟수를 보여 주는 데모로 만든다.
- 부모가 다시 그리지 않음 (`NoRerender`, 몇 번 눌러도 한 번)
- 실패 뒤 다시 누름 (`RetryAfterFailure`, 바쁨이 올랐다 내려가면 다시 누를 수 있음)

## 쓰는 화면
Confirm(`OrderConfirmSheet`), LimitChat(`LimitChangeCard`)

## 테스트 기준
- 부모가 다시 그리기 전에 두 번 눌러도 한 번
- `busy`면 부르지 않는다
- `busy`가 올랐다 내려가면 다시 부를 수 있다 (같은 주문으로 재시도, D-19)
- 잠금은 `busy`가 아닌 그리기에서만 풀린다

## 메모
- 두 번째 누름은 부모가 `busy=true`로 다시 그리기 전에 들어와서 `busy`만으로는 못 막는다. 그래서 ref로 잠그고, `busy`가 아닌 그리기의 effect에서 푼다.
- 부모는 콜백을 받으면 `busy`(confirming, status `'confirming'`)를 올려야 한다. 안 올리면 다음 그리기에서 잠금이 풀린다.
- Button의 `loading` 검사와 겹치는 곳(로딩 중 누름 무시)에는 쓰지 않는다. 다시 그리기 전 두 번 누름이 돈이나 한도를 움직일 때만 쓴다 (D-18 원칙 5, 2026-11-19 감사).
