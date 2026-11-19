---
node: leaf
parent: _index.md
children: []
---

# CapReached

`packages/ui/src/limits/CapReached/`

## 책임
30일 한도를 다 썼을 때 다시 채워지는 날을 크게 그린다.

## 책임 아님
리셋 시각 계산 (체인 resetAt을 서버가 줌)

## props
`resetAt: number`(unix 초), `cap: bigint` (aokrw), `onNotify: () => void`, `onDismiss: () => void`, `now: number` (unix ms, 부모가 넘김. 렌더를 순수하게 두고 테스트가 시각을 고정)

## 하네스 상태
`CapReached.stories.tsx`에 아래를 전부 만든다.
- 며칠 남음 (`DaysLeft`, Cap 시안 4일 뒤)
- 오늘 채워짐 (`Today`)

## 쓰는 화면
Cap

## 테스트 기준
- KST 표시 "12월 3일 오후 2시" (분이 0이면 빼고, 자정과 정오는 12시), 기기 시간대와 상관없이 (테스트는 서울이 아닌 시간대)
- unix 초를 ms로 바꾸는 실수 방지 테스트 (곱하기를 빼면 1970년이 나와 실패)
- 남은 날은 한국 달력 날짜로 센다: 같은 날은 "오늘", 하루는 "내일", 그 밖은 "N일 뒤에", 이미 지났으면 "오늘"
- 금액은 formatOkrw (Number를 넘는 금액으로 확인), 두 버튼은 각 콜백 한 번
- Cap 시안 값 (시각 30/700, 아래 15px `ink-secondary`, 간격 4, 버튼 사이 8)

## 메모
- Cap 시안은 오전과 오후를 쓴다 ("오후 2시"). OrderStatusHeader는 시안에 오전, 오후가 없어 24시간제다. 둘을 맞출지는 후속으로 본다.
- 위 용이 말("지갑이 텅 비었어용")은 화면이 그린다. 문구는 open-questions Q-26.
- 버튼은 base `Button` primary와 text.
