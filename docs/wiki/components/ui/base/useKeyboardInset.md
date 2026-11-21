---
node: leaf
parent: _index.md
children: []
---

# useKeyboardInset

`packages/ui/src/base/useKeyboardInset/`

## 책임
화면 키보드가 가린 높이(CSS 픽셀)를 `visualViewport`로 알려 주는 훅. 모양은 없다. 닫혀 있거나 `visualViewport`가 없으면 0 (D-23: 키보드가 올라와도 입력칸이 가려지지 않는다).

## 책임 아님
띠를 올리는 일 (부모가 받은 값으로 여백을 준다. `ChatLayout`), 입력 포커스

## props
`useKeyboardInset(): number`, 순수 계산은 `keyboardInset()`. 계산은 `innerHeight - visualViewport.height - visualViewport.offsetTop`을 0 아래로 내리지 않는다. iOS 사파리는 키보드가 올라와도 레이아웃 뷰포트 높이를 줄이지 않고 페이지를 밀어 올려, 이 값이 필요하다 (확인은 실기기에서, 추론).

## 하네스 상태
`useKeyboardInset.stories.tsx`의 `Demo`: 입력칸과 가린 높이 숫자. 훅이라 숫자를 보이는 데모로 만든다.

## 쓰는 화면
Main, LimitChat (`ChatLayout`)

## 테스트 기준
- `visualViewport`가 없으면 0
- 닫혀 있으면 0, 줄었다 돌아오면 가린 높이를 따라간다 (모의 `visualViewport`)
- 브라우저가 페이지를 민 만큼(`offsetTop`)은 뺀다
- 0 아래로 내려가지 않고, 사라질 때 이벤트를 푼다

## 메모
- 2026-11-21 D-23 다듬기: 결과는 레이아웃 속성(여백)이라 키보드 애니메이션은 OS가 맡는다. 우리가 움직이지 않는다.
