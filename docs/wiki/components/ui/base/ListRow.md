---
node: leaf
parent: _index.md
children: []
---

# ListRow

`packages/ui/src/base/ListRow/`

## 책임
설정 화면의 한 줄(이름, 값, 화살표 또는 스위치)을 그린다.

## 책임 아님
값 계산

## props
`label: string`, `value?: ReactNode` (부모가 formatOkrw로 만든 글자), `tone?: 'default' | 'accent'` (accent는 잎색 600), `trailing?: 'chevron' | ReactNode | ((labelId: string) => ReactNode)` (함수면 줄 이름의 id를 받아 Switch의 이름으로 쓴다), `onPress?: () => void`

## 하네스 상태
`ListRow.stories.tsx`에 아래를 전부 만든다.
- 값만 (`ValueOnly`, "30일 한도")
- 화살표 (`Chevron`, "한 번에 쓸 수 있는 돈")
- 스위치 (`WithSwitch`, "용이 멈추기")
- 강조 값(잎색) (`Accent`, "이번 달 아낀 돈")

## 쓰는 화면
Wallet

## 테스트 기준
- onPress 있으면 button, 없으면 div
- 이름, 값 순서. 값은 받은 그대로 (계산 없음)
- 'chevron'이면 Wallet 화살표, trailing이 없으면 16px 빈 칸 (값 정렬)
- 함수 trailing의 Switch가 줄 이름으로 읽힌다. 줄마다 id가 다르다
- Wallet 시안 값 (줄 56, 간격 8, 15px, 값 `ink-secondary`, 강조 잎색 600, 화살표 16 `ink-muted`)

## 메모
- 카드 안 읽기 전용 이름과 값 묶음은 ListRow가 아니라 `DetailRows`다. 합치지 않는 이유는 DetailRows 문서에 있다.
- 화살표는 base `Icon` `chevron-right`이고 크기와 색(16, `ink-muted`)은 이 컴포넌트 CSS가 정한다.
- Receipt의 줄은 카드 안의 촘촘한 양끝 정렬(14px, 높이 없음)이라 ListRow가 아니라 `OrderSummary`의 `details`가 그린다.
- onPress와 Switch trailing을 같이 쓰지 않는다 (버튼 안에 버튼이 된다). Wallet 시안도 스위치 줄은 div다.
- `size.listRow`(56), `size.rowIcon`(16) 토큰을 쓴다.
