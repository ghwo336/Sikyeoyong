---
node: leaf
parent: _index.md
children: []
---

# AmountStepper

`packages/ui/src/limits/AmountStepper/`

## 책임
이름 붙은 "− 금액 +" 한 줄로 금액을 단위만큼 내리고 올린다.

## 책임 아님
범위와 단위 정하기 (부모가 shared `policy.ts` `AmountRange`에서 넘김), 저장과 재인증 (부모가 `onChange` 값을 들고 확정 버튼에서 처리), 드래곤 성장 (`DragonLine` `stage`)

## props
`label: string` ("한 번에 쓸 돈", "30일에 쓸 돈". 묶음 이름과 버튼 이름에도 쓴다), `value: bigint` (aokrw), `min: bigint`, `max: bigint`, `step: bigint` (aokrw), `onChange: (value: bigint) => void` (다음 금액, 늘 min과 max 안)

## 하네스 상태
`AmountStepper.stories.tsx`에 아래를 전부 만든다.
- 한 번에 쓸 돈 (`PerOrder`, Budget 시안, 눌러 보면 숫자가 굴러간다)
- 30일에 쓸 돈 (`MyPeriodic`, Budget 시안)
- 맨 아래, − 흐리게 (`AtMin`)
- 맨 위, + 흐리게 (`AtMax`)

## 쓰는 화면
Budget (D-31, user-flow 5). 한도 설정 화면이 생기면 같은 부품을 쓴다.

## 테스트 기준
- `label`이 이름인 group 안에 −, 금액(output), + 순서
- 금액은 `aria-live="polite"` output이고 formatOkrw로 읽힌다. Number를 넘는 금액도 정확히
- 누르면 한 단위 움직인 bigint로 onChange 한 번, 키보드 Enter도 같다
- 버튼 이름은 "{label} {단위}원 내리기", "{label} {단위}원 올리기" (예: "한 번에 쓸 돈 5,000원 올리기")
- min에서 −, max에서 +는 `aria-disabled`, 흐리게, 눌러도 onChange 없음, 포커스는 그대로
- 단위에 안 맞는 값에서 눌러도 min, max를 넘지 않는다 (잘라 낸다)
- 숫자는 base `Amount` animate로 자리별로 굴러간다
- Budget 시안 값 (제목 15/600, 제목과 칸 사이 10, 칸 64 흰 바탕 1px `line` 반경 18, 안쪽 0 8, 간격 12, 버튼 48 동그라미 `track`, 금액 24/700 고정폭)

## 메모
- 두 버튼은 base `Button` soft `round`(48 동그라미, 22/600 기호)이고 `disabled`, `label`로 끝 금액과 화면 읽기 이름을 맞춘다. 누름 0.97 스프링도 Button 것이다 (press.test).
- 숫자 굴러가기(motion.number 400ms)와 동작 줄이기 처리는 base `Amount`가 한다. 동작 줄이기면 숫자가 바로 바뀐다.
- 시안 값을 옮길 때 맞는 토큰이 따로 없어 값이 같은 토큰을 썼다: 칸 높이 64는 `size.pickRow`, 제목과 칸 사이 10은 `size.summaryGap`, 반경 18은 `radius.button`, 버튼 바탕 #EEF3EC는 `track`(#EEF2EC), 금액 24/700은 `type.pay`. 시안이 바뀌면 tokens.json에 이름을 따로 둔다.
- 꾹 누르면 계속 움직이기는 넣지 않았다 (시안에 없음). 범위 칸 수가 많지 않다 (한 번에 10칸, 30일에 10칸 안팎).
- 2026-11-20 D-31로 만들었다. Budget 화면의 옛 예산 칩(BudgetPicker)을 대신한다.
