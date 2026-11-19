---
node: leaf
parent: _index.md
children: []
---

# HatchProgress

`packages/ui/src/onboarding/HatchProgress/`

## 책임
부화 세 단계(용돈 주머니, 신분증, 한도 새기기)의 진행을 그린다.

## 책임 아님
상태 폴링 (부모 훅)

## props
`steps: { label, status: 'done' | 'doing' | 'waiting' | 'failed' }[]`, `onRetry?`

## 하네스 상태
`HatchProgress.stories.tsx`에 아래를 전부 만든다.
- 처음
- 신분증 중
- 모두 완료
- 실패와 다시 깨우기

## 쓰는 화면
Hatch

## 테스트 기준
- failed일 때만 onRetry

## 메모
없음
