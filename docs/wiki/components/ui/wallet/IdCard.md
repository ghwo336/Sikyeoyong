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
`name: string`, `ownerName: string`, `level: number`, `perOrder: bigint` (aokrw), `ownerVerified: boolean`, `bornAt: number` (unix ms), `species: DragonSpecies` (카드 색, D-20에 따라 `color` 대신)

## 하네스 상태
`IdCard.stories.tsx`에 아래를 전부 만든다.
- 레벨 1 (`LevelOne`, IdCard 시안)
- 레벨 3 날개 (`LevelThreeWings`)
- 주인 미인증 (`OwnerNotVerified`)

## 쓰는 화면
IdCard

## 테스트 기준
- ownerVerified=false면 '실명 확인 전', true면 '실명 확인됨'
- 이름, "{주인}님의 배달 비서", 레벨, "N원까지"(formatOkrw, Number를 넘는 금액으로 확인), 태어난 날 KST "2026. 12. 1." (기기 시간대와 상관없이)
- 레벨 3부터 날개, 초상 용이는 64
- 카드 바탕은 종 색 (숲 연두, 물 하늘, 꽃 분홍, 별 보라)
- IdCard 시안 값 (1.5px ink 테두리 반경 22, 여백 20, 간격 18, 초상 76 반경 18 `eggShell`, 이름 24/700, 사실 13px 라벨 `cardInk`와 16/600 값, 칸 간격 14 12)

## 메모
- 아래 "가게는 주문을 받을 때 이 신분증을 봐요"와 "신분증 공유하기"는 IdCard 화면이 그린다.
- 1.5px 테두리는 용이 그림 선 굵기와 같아 리터럴로 둔다.
