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
`value: bigint` (aokrw), `max: bigint` (aokrw), `label: string`, `tone: 'normal' | 'warn' | 'over'`, `size?: 'sm' | 'md'` (기본 `sm`: Main 13px, 간격 8. `md`: Arrived 14px, 간격 12), `kind?: 'budget' | 'limit'` (기본 `budget`: 이번 달 예산, 노른자. `limit`: 용이 한도, 잎색, 진한 바탕, 간격 6), `framed?: boolean` (기본 false. Main 흰 카드 안에 그린다)

## 하네스 상태
`Meter.stories.tsx`에 아래를 전부 만든다.
- 30% (`Thirty`)
- 70% 노른자 (`SeventyYolk`, Main 시안)
- 100% 호박색 (`FullAmber`, 한도를 넘은 값)
- 0 (`Zero`)
- Arrived 크기 (`ArrivedSize`)
- Confirm 한도 막대 (`ConfirmLimit`)
- Main 흰 카드 (`Framed`)

## 쓰는 화면
Main, Arrived (예산), Confirm (한도)

## 테스트 기준
- value가 max보다 커도 막대는 100%
- 채움 비율은 bigint로만 계산한다 (`fillBasisPoints`, 만분율). max가 0이면 쓴 돈이 있을 때 100%, 없으면 0
- 숫자는 formatOkrw. 앞 숫자는 원 없이 굵게, 뒤는 " / 300,000원"
- role meter, 라벨 이름, aria-valuetext는 "210,000원 / 300,000원"
- Main, Arrived, Confirm 시안 값 (막대 8, 반경 4. budget은 `track` 바탕에 노른자, limit은 `line` 바탕에 잎색과 간격 6. warn 노른자, over 호박색은 둘 다 같음)
- kind 클래스는 하나만, 기본은 budget
- framed일 때만 `data-framed`, 카드 값은 Main 시안 (흰 바탕, 1px `line`, 반경 16 `radius.budgetCard`, 안쪽 12 14 `size.budgetCardPadX`)

## 메모
- 숫자 줄("값 / 한도원")은 base `AmountRatio` meter(값 뒤 원 없음)다.
- 막대는 두 종류다. 이번 달 예산(Main 70%, Arrived 73%)은 노른자, 용이 한도(Confirm "한 번에" 90%, "30일 동안" 44%)는 잎색이다. 시안에서 읽은 구분이다 (추론, Q-28).
- 색: `normal`은 종류에 따라 노른자(budget) 또는 잎색(limit), `warn`은 노른자, `over`는 호박색(`color.over`, D-17 빨강 대신 호박색). 예산 막대는 평소에도 노른자라 70% 알림은 색보다 용이 말로 준다. 확정은 open-questions Q-28.
- `limit`은 `sm`과만 쓴다 (Confirm). `.meter.limit`의 간격 6이 size 간격보다 우선한다.
- tone을 고르는 기준은 부모가 `nagStage`(packages/shared policy)로 정한다. 막대는 받은 tone만 칠한다.
- 퍼센트는 표시용 숫자로만 바꾼다. 돈 계산이 아니다.
- 카드(`framed`)는 2026-11-19에 Main 시안 "이번 달 배달비" 카드를 그리려고 늘렸다. 화면 양옆 20은 카드가 아니라 `ChatLayout` top 띠가 준다.

- 바탕 띠(D-32, 2026-11-20 브라우저 QA 2차): `color.track`(#EEF2EC, 숲의 녹회색) 대신 `--theme-track`(`tokens/base.css`, 테마 dark 4%를 테마 bg에 섞음. 숲은 #EDF2ED)을 쓴다. 물용, 별용 화면에 녹회색 띠가 남지 않게. 고정 테마(`data-theme="fixed"`) 화면은 숲 값을 다시 받는다. 채움 색(노른자, 잎색, 경고)은 그대로다.
