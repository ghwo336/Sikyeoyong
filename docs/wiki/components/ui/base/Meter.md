---
node: leaf
parent: _index.md
children: []
---

# Meter

`packages/ui/src/base/Meter/`

## 책임
현재 값과 한도를 막대로 그린다 (예산, 한 번에, 30일).

## 책임 아님
넘었는지 판단해서 문구 바꾸기 (부모가 `tone`을 넘김)

## props
`value: bigint` (aokrw), `max: bigint` (aokrw), `label: string`, `tone: 'normal' | 'warn' | 'over'`, `size?: 'sm' | 'md'` (기본 `sm`: Main 13px, 간격 8. `md`: Arrived 14px, 간격 12)

## 하네스 상태
`Meter.stories.tsx`에 아래를 전부 만든다.
- 30% (`Thirty`)
- 70% 노른자 (`SeventyYolk`, Main 시안)
- 100% 호박색 (`FullAmber`, 한도를 넘은 값)
- 0 (`Zero`)
- Arrived 크기 (`ArrivedSize`)

## 쓰는 화면
Main, Confirm, Arrived

## 테스트 기준
- value가 max보다 커도 막대는 100%
- 채움 비율은 bigint로만 계산한다 (`fillBasisPoints`, 만분율). max가 0이면 쓴 돈이 있을 때 100%, 없으면 0
- 숫자는 formatOkrw. 앞 숫자는 원 없이 굵게, 뒤는 " / 300,000원"
- role meter, 라벨 이름, aria-valuetext는 "210,000원 / 300,000원"
- Main, Arrived 시안 값 (막대 8, 반경 4, `track` 바탕, 색 tone별)

## 메모
- Confirm 시안에는 막대가 없다. 쓰는 화면은 지금 Main, Arrived다.
- 색: `warn` 노른자(`color.yolk`, Main 70%), `over` 호박색(`color.over`, D-17 빨강 대신 호박색). `normal`은 시안에 없어 잎색(`color.leaf`)으로 그렸다 (추론). 확정은 open-questions Q-28.
- tone을 고르는 기준은 부모가 `nagStage`(packages/shared policy)로 정한다. 막대는 받은 tone만 칠한다.
- 퍼센트는 표시용 숫자로만 바꾼다. 돈 계산이 아니다.
