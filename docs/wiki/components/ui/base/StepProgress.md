---
node: leaf
parent: _index.md
children: []
---

# StepProgress

`packages/ui/src/base/StepProgress/`

## 책임
몇 단계 중 몇 번째인지 칸으로 그린다 (가입 3단계, 주문 4단계).

## 책임 아님
단계 이름 정하기 (props로 받음)

## props
`steps: readonly string[]`, `current: number` (1부터 센다), `showLabels?: boolean`, `size?: 'sm' | 'md'` (기본 `sm`: 4px 칸, 가입. `md`: 6px 칸, 주문)

## 하네스 상태
`StepProgress.stories.tsx`에 아래를 전부 만든다.
- 가입 1/3 (`SignupFirst`, Verify 시안)
- 주문 조리 중 (`OrderCooking`, Done 시안, 이름 표시)
- 모두 완료 (`AllDone`, Arrived 시안)

## 쓰는 화면
Verify, Name, Budget, Done, Tracking, Arrived

## 테스트 기준
- role progressbar, aria-label에 'N단계 중 M단계' (이름을 보이면 ", 조리 중"을 붙인다), aria-valuenow
- current 범위 밖 값 방어: 1보다 작거나 NaN이면 1, 개수보다 크면 마지막, 소수는 내림 (`clampStep`)
- 현재 단계까지 잎색으로 채운다. 이름 줄은 현재 단계만 진하게
- 시안 값 (칸 4 또는 6, 반경은 높이의 절반, 칸 간격 4, 빈 칸 `line`, 이름 13px `ink-secondary`, 막대와 이름 사이 10)

## 메모
- 가입 단계 막대는 TopBar 안에 들어간다 (Verify, Name, Budget 시안). 주문 단계는 화면 본문에 둔다.
- 이름 줄은 보이는 글자지만 스크린 리더에는 aria-label 하나로 읽힌다 (aria-hidden).
- 막대와 이름 사이 10px은 4 단위 간격 척도에 없어 리터럴로 둔다.
