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
`txHash: string`, `agentId: string`, `rules: readonly string[]` (서버 영수증이 준 규칙 이름 그대로), `explorerUrl: string`, `defaultOpen?: boolean`

## 하네스 상태
`ReceiptDetails.stories.tsx`에 아래를 전부 만든다.
- 접힘 (`Closed`)
- 펼침 (`Open`, Receipt 시안)
- 규칙 없음(경로 C 등) (`NoRules`)

## 쓰는 화면
Receipt

## 테스트 기준
- aria-expanded와 aria-controls, 클릭과 Enter로 열고 닫음
- 체인이 실제로 검사한 규칙만 넘긴다는 전제 (tech-spec 2.5). 받은 목록을 순서 그대로, 개수와 함께 보이고 더하거나 빼지 않는다
- 규칙이 없으면(경로 C) 규칙 묶음을 그리지 않는다
- 결제 기록 번호는 앞 6자와 끝 4자로 줄이고(12자 이하는 그대로) 전체는 title
- 탐색기 링크는 새 탭, rel noopener noreferrer, 높이 44
- Receipt 시안 값 (카드 `line` 반경 20, 토글 52 15/600, 화살표 18, 펼침 13px, 규칙 12px 고정폭 줄간격 1.7 `inkCode`)

## 메모
블록체인 말은 이 컴포넌트 안에서만 쓴다 (design-and-motion).
- 화살표는 펼치면 180도 돈다. 동작 줄이기면 돌지 않고 바로 바뀐다.
- `color.inkCode`, `type.code`, `size.detailsToggle`, `size.detailsIcon` 토큰을 쓴다.
