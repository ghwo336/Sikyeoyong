---
node: leaf
parent: _index.md
children: []
---

# AllowanceSummary

`packages/ui/src/wallet/AllowanceSummary/`

## 책임
주인 용돈 금액과 용이 주머니 금액, 채우기 버튼을 그린다.

## 책임 아님
충전 실행

## props
`owner: bigint` (aokrw, 주인님 용돈), `pocket: bigint` (aokrw, 용이 주머니), `onTopUp: () => void`, `loading?: boolean`, `onRetry?: () => void` (주면 못 불러온 상태)

## 하네스 상태
`AllowanceSummary.stories.tsx`에 아래를 전부 만든다.
- 기본 (`Default`, Wallet 시안)
- 용돈 0 (`Empty`)
- 로딩 (`Loading`)
- 못 불러옴 (`Failed`)

## 쓰는 화면
Wallet

## 테스트 기준
- 주소를 보여 주지 않는다 (주소 prop이 없다는 것을 `@ts-expect-error`로 typecheck가 지키고, 글자는 시안 문구와 금액뿐)
- 금액은 formatOkrw (Number를 넘는 금액으로 확인)
- 채우기는 onTopUp 한 번 (base Button primary md)
- 로딩이면 숫자 없이 멈춘 회색 줄 두 개와 aria-busy, 채우기는 눌러도 시작하지 않음 (잔액을 모르는 채 충전하지 않게)
- `onRetry`가 있으면 숫자와 채우기 없이 `RetryLine`("용돈을 못 불러왔어요")이 같은 자리에 서고, 다시 불러오기는 `onRetry` 한 번
- Wallet 시안 값 (라벨 14px, 금액 34/700, 주머니 13px `ink-secondary`, 간격 4, 위아래 여백 16 20)

## 메모
- 불러오는 중 막대는 base `Skeleton`(walletAmount 10em, caption 7.5em)이다.
- 채우기는 돈이 움직이는 일이라 이 버튼(사용자)으로만 시작한다. LLM 도구에는 충전이 없다 (CLAUDE.md 절대 규칙 3).
- `type.walletAmount` 토큰을 쓴다.
