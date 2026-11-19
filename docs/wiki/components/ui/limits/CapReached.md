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
`resetAt: number`(unix 초), `cap: bigint`, `onNotify`, `onDismiss`

## 하네스 상태
`CapReached.stories.tsx`에 아래를 전부 만든다.
- 며칠 남음
- 오늘 채워짐

## 쓰는 화면
Cap

## 테스트 기준
- KST 표시
- unix 초를 ms로 바꾸는 실수 방지 테스트

## 메모
없음
