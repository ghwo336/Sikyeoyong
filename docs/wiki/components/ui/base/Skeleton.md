---
node: leaf
parent: _index.md
children: []
---

# Skeleton

`packages/ui/src/base/Skeleton/`

## 책임
불러오는 중인 글자 자리에 멈춰 있는 회색 막대 하나를 그린다.

## 책임 아님
불러오는 중 알리기 (부모가 `aria-busy`나 `role="status"`를 단다), 몇 개를 어떻게 놓을지 (부모)

## props
`height: 'walletAmount' | 'caption' | 'meta'` (그 자리 글자 크기 토큰), `width: string` (CSS 길이, 그 글자쯤 되는 길이), `data-*` (부모 테스트와 CSS 표시, 예: `data-part="skeleton"`)

## 하네스 상태
`Skeleton.stories.tsx`에 아래를 전부 만든다.
- 지갑 금액 자리 (`WalletAmount`)
- 작은 글 자리 (`Caption`)
- 추천 줄 자리 (`MetaRows`)

## 쓰는 화면
Wallet(`AllowanceSummary`), Main(`RecommendationList`)

## 테스트 기준
- 화면 읽기에 숨김
- 너비와 높이 클래스가 붙는다
- data 표시가 그대로 붙는다
- 움직이지 않는다 (애니메이션, 전환 없음)
- 높이는 글자 토큰, 색은 `track`, 끝은 알약

## 메모
- 2026-11-19 재사용 감사(D-18 원칙 5)로 AllowanceSummary와 RecommendationList의 막대를 모았다.
- 반짝임은 넣지 않는다 (design-and-motion.md, 동작 줄이기에도 따로 할 일이 없다). 시안에는 불러오는 중 모양이 없다 (디자인 선택).
- 너비는 em이나 %로 받는다. em은 막대가 놓인 곳의 글자 크기를 따른다.
