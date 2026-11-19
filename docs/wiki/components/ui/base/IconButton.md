---
node: leaf
parent: _index.md
children: []
---

# IconButton

`packages/ui/src/base/IconButton/`

## 책임
글자 없이 아이콘 하나만 보이는 44px 버튼을 그린다 (뒤로, 설정).

## 책임 아님
누르면 무엇을 할지 (`onPress`), 아이콘 모양 (base `Icon`)

## props
`icon: IconName`, `label: string` (화면 읽기 이름, 보이는 글자는 없다), `onPress: () => void`, `edge?: 'start'` (왼쪽으로 10 당겨 아이콘을 화면 여백 20에 맞춘다)

## 하네스 상태
`IconButton.stories.tsx`에 아래를 전부 만든다.
- 뒤로, 왼쪽 당김 (`Back`, Name 시안)
- 설정 (`Settings`, Main 시안)

## 쓰는 화면
Verify, Name, Receipt, IdCard, Frozen (TopBar 뒤로), Main (ChatHeader 설정)

## 테스트 기준
- `type="button"`, `aria-label`이 이름, 클릭과 Enter로 onPress 한 번
- 아이콘만 있고 화면 읽기에는 숨긴다
- `edge`를 줄 때만 `data-edge="start"`
- 시안 값 (44 x 44 투명, 아이콘 22 `ink`, 당김 -10, 포커스 2px 잎색)

## 메모
- TopBar 뒤로 버튼과 ChatHeader 설정 버튼이 같은 모양이라 2026-11-19에 뽑았다 (D-18 원칙 5).
- 아이콘 22는 `size.backIcon` 토큰이다. 설정 점 세 개도 시안이 22라 같은 토큰을 쓴다.
- 누름 효과(0.97)는 없다. 시안 두 곳 모두 바탕 없는 아이콘이라 `motion.button`을 쓰지 않는다 (press.test).
- Main 시안의 설정 버튼은 반경 12지만 바탕이 투명해 포커스 테두리에만 보인다. 반경 토큰이 없어 두지 않았다.
