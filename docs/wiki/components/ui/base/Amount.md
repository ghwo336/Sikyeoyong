---
node: leaf
parent: _index.md
children: []
---

# Amount

`packages/ui/src/base/Amount/`

## 책임
금액 숫자를 그리고, 값이 바뀌면 자리별로 굴러가며 바뀐다.

## 책임 아님
금액 계산

## props
`value: bigint`, `size: 'display' | 'title' | 'row' | 'inherit'` (inherit: 부모 글자 크기, AmountChange와 AmountRatio가 쓴다), `animate?: boolean`, `unit?: boolean` (false면 끝의 원을 뺀다, 기본 true)

## 하네스 상태
`Amount.stories.tsx`에 아래를 전부 만든다.
- 정적
- 값 변경 애니메이션
- 동작 줄이기 설정

## 쓰는 화면
Confirm, Wallet, Blocked, LimitChat (AmountChange, AmountRatio를 거쳐서)

## 테스트 기준
- formatOkrw 결과와 같은 글자 (unit=false면 끝의 원만 뺀 글자)
- reduced motion이면 애니메이션 없음

## 메모
- 글자는 `formatOkrw` 결과 그대로다. 굴릴 때는 자리마다 0~9 열을 `transform`으로 400ms 움직이고(tokens.json motion.number), 스크린 리더에는 숨김 처리한 열 대신 금액 한 줄만 읽힌다.
- `animate`가 없거나 동작 줄이기가 켜지면 평범한 글자로 그린다 (페이드도 없이 바로 바뀐다. 이 문서의 테스트 기준 "애니메이션 없음"을 따른다). 동작 줄이기 판단은 `base/reduced-motion.ts`의 `useShouldReduceMotion`(기기 설정 또는 `MotionConfig reducedMotion="always"`)이고 Button도 같은 훅을 쓴다.
- 고정폭 숫자(tabular-nums).
