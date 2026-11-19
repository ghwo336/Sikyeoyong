---
node: leaf
parent: _index.md
children: []
---

# LimitBlocked

`packages/ui/src/limits/LimitBlocked/`

## 책임
넘은 금액과 한도를 크게 비교하고 두 선택지(레벨 올리기, 다시 고르기)를 그린다.

## 책임 아님
레벨 변경 (콜백)

## props
`attempted: bigint`, `limit: bigint`, `nextLevel?: { level, limit: bigint }`, `onRaise`, `onRepick`

## 하네스 상태
`LimitBlocked.stories.tsx`에 아래를 전부 만든다.
- 기본
- 다음 레벨 없음(최고 레벨)

## 쓰는 화면
Blocked

## 테스트 기준
- 설명 문단 없음 (슬롭 금지)
- nextLevel 없으면 올리기 버튼 숨김

## 메모
없음
