---
node: leaf
parent: _index.md
children: []
---

# IdCard

`packages/ui/src/wallet/IdCard/`

## 책임
용이 신분증 카드(이름, 주인, 한 번에, 실명 확인, 태어난 날)를 그린다.

## 책임 아님
신분증 조회

## props
`name: string`, `ownerName: string`, `perOrder: bigint` (aokrw, 한 번에 한도. 초상의 자란 정도도 이 값으로 정한다), `ownerVerified: boolean`, `bornAt: number` (unix ms), `species: DragonSpecies` (카드 색, D-20에 따라 `color` 대신)

## 하네스 상태
`IdCard.stories.tsx`에 아래를 전부 만든다.
- 기본 (`Default`, IdCard 시안, 한 번에 10,000원)
- 날개 (`Wings`, 한 번에 50,000원으로 3단계)
- 주인 미인증 (`OwnerNotVerified`)

## 쓰는 화면
IdCard

## 테스트 기준
- ownerVerified=false면 '실명 확인 전', true면 '실명 확인됨'
- 이름, "{주인}님의 배달 비서", "N원까지"(formatOkrw, Number를 넘는 금액으로 확인), 태어난 날 KST "2026. 12. 1." (기기 시간대와 상관없이)
- 레벨 줄이 없다 (D-31)
- 날개는 `dragonStage(perOrder) === 3`일 때만 (30,000원은 없음, 35,000원은 있음), 초상 용이는 64이고 카드와 같은 종
- 카드 바탕은 종 색 (숲 연두, 물 하늘, 꽃 분홍, 별 보라)
- IdCard 시안 값 (1.5px ink 테두리 반경 22, 여백 20, 간격 18, 초상 76 반경 18 `eggShell`, 이름 24/700, 사실 13px 라벨 `cardInk`와 16/600 값, 칸 간격 14 12)

## 메모
- 세 가지 사실은 base `DetailRows` stacked(두 칸, 이름 `card-ink`, 값 16/600)다.
- 태어난 날 글자는 `packages/shared`의 `formatKstDate`(time/kst)이다. 이 컴포넌트는 예전 import를 위해 다시 내보내기만 한다.
- 아래 "가게는 주문을 받을 때 이 신분증을 봐요"와 "신분증 공유하기"는 IdCard 화면이 그린다.
- 1.5px 테두리는 용이 그림 선 굵기와 같아 리터럴로 둔다.
- 머리줄 간격과 칸 행 간격 14는 `size.limitsGap` 값을 같이 쓴다 (값이 같아서).
- 2026-11-20 D-31로 레벨이 없어져 `level` prop과 레벨 줄을 뺐다. 날개는 한 번에 한도의 단계(`packages/shared` `dragonStage`)로 정한다.
