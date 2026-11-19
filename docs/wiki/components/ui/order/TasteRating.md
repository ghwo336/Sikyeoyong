---
node: leaf
parent: _index.md
children: []
---

# TasteRating

`packages/ui/src/order/TasteRating/`

## 책임
맛 평가 세 가지 중 하나를 고르게 한다.

## 책임 아님
평가 저장

## props
`menu: string` (질문 "오늘 {menu} 어땠어요?"), `value?: 'again' | 'okay' | 'meh'`, `onPick: (value) => void`

## 하네스 상태
`TasteRating.stories.tsx`에 아래를 전부 만든다.
- 안 고름 (`NotPicked`, Arrived 시안)
- 고름 (`Picked`)

## 쓰는 화면
Arrived

## 테스트 기준
- onPick 값 세 가지 (again, okay, meh)
- 질문이 이름인 radiogroup, Chip tile 세 개가 시안 순서 (또 먹을래, 괜찮았어, 별로였어)
- 고른 것만 aria-checked, 고르기 전에는 모두 false
- Arrived 시안 값 (질문 15/600, 세 칸 같은 폭, 간격 8, 질문과 칸 사이 10)

## 메모
- Arrived 시안에는 고른 상태가 없다. 하네스가 "고름"을 요구하고 한 번 더 바꿀 수 있어야 해서 고르기(radio)로 정했다 (디자인 선택). Chip.md 메모의 열린 판단을 이걸로 닫는다.
- 칸 모양은 base `Chip`의 `tile`(52, 15/400).
