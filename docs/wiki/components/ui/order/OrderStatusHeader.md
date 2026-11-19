---
node: leaf
parent: _index.md
children: []
---

# OrderStatusHeader

`packages/ui/src/order/OrderStatusHeader/`

## 책임
도착 예정 시각(분 단위)과 남은 시간을 크게 그린다.

## 책임 아님
시간 계산 (서버가 eta를 줌)

## props
`etaAt: number`(unix ms), `remainingMin: number` (서버가 준 분), `variant: 'eta-first' | 'remaining-first'`, `distance?: string` (Tracking, 부모가 만든 "1.2km")

## 하네스 상태
`OrderStatusHeader.stories.tsx`에 아래를 전부 만든다.
- 조리 중 (`Cooking`, Done 시안)
- 배달 중 (`Delivering`, Tracking 시안)
- 지연 갱신 (`Delayed`)

## 쓰는 화면
Done, Tracking

## 테스트 기준
- KST로 'N시 M분' 표시, 기기 시간대와 상관없이 (테스트는 서울이 아닌 시간대에서 돈다), 24시간제
- eta-first는 "N시 M분 도착 예정"이 크고 남은 시간이 작다. remaining-first는 반대이고 작은 줄 끝에 거리
- 남은 분은 올림, 0 이하나 숫자가 아니면 "곧 도착해요"
- 고정폭 숫자, 시안 값 (큰 줄 30/700, 작은 줄 15px `ink-secondary`, 간격 4)

## 메모
- 시각 글자는 `packages/shared`의 `formatKstClock`(time/kst)이다. 이 컴포넌트는 예전 import를 위해 다시 내보내기만 한다 (2026-11-19 재사용 감사).
- 시안의 "12시 55분"은 오전과 오후를 말하지 않는다. 헷갈리지 않게 24시간제("13시 5분")로 쓴다 (디자인 선택).
- 지연은 숫자만 바뀐다. 늦어진다는 말은 용이가 한다 (user-flow 9단계).
- 이 컴포넌트는 숫자를 계산하지 않는다. 남은 분과 거리는 서버 값이다.
