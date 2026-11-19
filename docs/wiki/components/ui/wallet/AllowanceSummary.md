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
`owner: bigint`, `pocket: bigint`, `onTopUp`

## 하네스 상태
`AllowanceSummary.stories.tsx`에 아래를 전부 만든다.
- 기본
- 용돈 0
- 로딩

## 쓰는 화면
Wallet

## 테스트 기준
- 주소를 보여 주지 않는다

## 메모
없음
