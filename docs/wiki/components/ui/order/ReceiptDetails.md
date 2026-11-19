---
node: leaf
parent: _index.md
children: []
---

# ReceiptDetails

`packages/ui/src/order/ReceiptDetails/`

## 책임
자세히 보기를 접고 펼치며 결제 기록 번호, 신분증 번호, 통과한 마루 규칙, 탐색기 링크를 그린다.

## 책임 아님
규칙 목록 계산 (서버 영수증)

## props
`txHash`, `agentId`, `rules: string[]`, `explorerUrl`, `defaultOpen?`

## 하네스 상태
`ReceiptDetails.stories.tsx`에 아래를 전부 만든다.
- 접힘
- 펼침
- 규칙 없음(경로 C 등)

## 쓰는 화면
Receipt

## 테스트 기준
- aria-expanded
- 체인이 실제로 검사한 규칙만 넘긴다는 전제 (tech-spec 2.5)

## 메모
블록체인 말은 이 컴포넌트 안에서만 쓴다 (design-and-motion).
