---
node: leaf
parent: _index.md
children: []
---

# AmountRatio

`packages/ui/src/base/AmountRatio/`

## 책임
두 금액을 "값 / 한도"로 그린다. 두 금액 모두 formatOkrw.

## 책임 아님
막대 (Meter), 넘었는지 판정 (부모), 금액 계산

## props
`value: bigint`, `max: bigint` (aokrw), `size: 'meter' | 'blocked'` (meter: 부모 글자 크기, 값 600 ink, 한도 보통 `ink-secondary` / blocked: 값 36/700 `over-ink`, 한도 16px `ink-secondary`, 가운데 줄바꿈), `valueUnit?: boolean` (false면 값 뒤 원을 뺀다, 기본 true), `suffix?: string` (한도 뒤 말, Blocked "까지")

## 하네스 상태
`AmountRatio.stories.tsx`에 아래를 전부 만든다.
- 막대 위 숫자 (`Meter`)
- 막힘 (`Blocked`)
- 아주 큰 금액 (`Huge`)

## 쓰는 화면
Main과 Confirm과 Arrived(`Meter`), Blocked(`LimitBlocked`)

## 테스트 기준
- "값 / 한도"로 읽히고 둘 다 formatOkrw
- meter는 값 뒤 원 없이 한 번만 ("210,000 / 300,000원")
- Number를 넘는 금액도 정확히
- size 클래스
- 시안 값 (meter 값 600 ink, 한도 `ink-secondary`, blocked 36/700 `over-ink`와 16px, 간격 10)

## 메모
- 2026-11-19 재사용 감사(D-18 원칙 5)로 Meter와 LimitBlocked의 "값 / 한도"를 모았다. 값은 base `Amount`(`size="inherit"`, 필요하면 `unit={false}`)로 그린다.
- 글자는 "값 / 한도" 한 덩어리로 읽힌다 (한도 앞 공백은 한도 쪽 글자에 있다).
