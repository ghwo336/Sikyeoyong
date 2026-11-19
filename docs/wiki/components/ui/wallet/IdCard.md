---
node: leaf
parent: _index.md
children: []
---

# IdCard

`packages/ui/src/wallet/IdCard/`

## 책임
용이 신분증 카드(이름, 주인, 레벨, 한 번에, 실명 확인, 태어난 날)를 그린다.

## 책임 아님
신분증 조회

## props
`name`, `ownerName`, `level`, `perOrder: bigint`, `ownerVerified: boolean`, `bornAt: number`, `color`

## 하네스 상태
`IdCard.stories.tsx`에 아래를 전부 만든다.
- 레벨 1
- 레벨 3 날개
- 주인 미인증

## 쓰는 화면
IdCard

## 테스트 기준
- ownerVerified=false면 '실명 확인 전'

## 메모
없음
