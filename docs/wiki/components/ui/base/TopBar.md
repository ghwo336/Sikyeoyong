---
node: leaf
parent: _index.md
children: []
---

# TopBar

`packages/ui/src/base/TopBar/`

## 책임
화면 위 뒤로 가기와 제목을 그린다.

## 책임 아님
라우팅 (onBack 콜백)

## props
`title?: string` (화면 제목, h1), `onBack?: () => void` (없으면 뒤로 버튼도 없다), `backLabel?: string` (기본 "뒤로", Done과 Tracking은 "대화로 돌아가기"), `trailing?: ReactNode` (나머지 폭을 채운다. 가입 단계 막대)

## 하네스 상태
`TopBar.stories.tsx`에 아래를 전부 만든다.
- 뒤로만 (`BackOnly`, Frozen 시안)
- 제목 (`WithTitle`, Receipt 시안)
- 단계 표시 포함 (`WithSteps`, Name 시안)
- 단계 표시, 뒤로 없음 (`StepsNoBack`, Budget 시안)
- 대화로 돌아가기 (`BackToChat`, Done 시안)

## 쓰는 화면
Verify, Name, Budget, Done, Receipt, IdCard, Frozen

## 테스트 기준
- 뒤로 버튼 aria-label "뒤로" (backLabel로 바꿀 수 있다), 클릭과 Enter로 onBack 한 번
- onBack이 없으면 버튼이 없다. trailing만 있으면 34px 빈 칸으로 줄을 맞춘다 (Budget)
- 제목은 h1
- 시안 값 (막대 48, 버튼 44를 왼쪽으로 10 당김, 화살표 22 선 2, 제목 17/600, trailing 앞 간격 8)

## 메모
- `type.barTitle`(17/600), `size.topBar`(48), `size.backIcon`(22) 토큰을 쓴다.
- 왼쪽 10px 당김과 34px 빈 칸은 화살표를 화면 여백 20에 맞추는 시안 보정이라 리터럴로 둔다.
- Wallet의 "용이 용돈"(20/700, 뒤로 없음)은 화면 제목이라 TopBar가 아니라 그 화면이 그린다.
