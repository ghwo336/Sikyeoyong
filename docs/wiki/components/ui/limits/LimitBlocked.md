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
`attempted: bigint` (aokrw), `limit: bigint` (aokrw, 지금 한 번에 한도), `nextLevel?: { level: number; limit: bigint }`, `onRaise: () => void`, `onRepick: () => void`

## 하네스 상태
`LimitBlocked.stories.tsx`에 아래를 전부 만든다.
- 기본 (`Default`, Blocked 시안)
- 다음 레벨 없음(최고 레벨) (`TopLevel`)

## 쓰는 화면
Blocked

## 테스트 기준
- 설명 문단 없음 (슬롭 금지): 글자는 금액 비교와 두 버튼뿐
- nextLevel 없으면 올리기 버튼 숨김
- 버튼마다 맞는 콜백 한 번. 올리기 버튼 이름은 "레벨 N(으)로 올리고 시키기 한 번에 M원까지"
- 금액은 formatOkrw (Number를 넘는 금액으로 확인), 레벨 뒤 로/으로는 숫자 읽기로 고름 (3, 6, 0은 으로)
- Blocked 시안 값 (넘은 금액 36/700 `overInk`, 한도 16px, 간격 10, 올리기 64 잎색 17/700과 13px `leafSubInk`, 다시 고르기 52 테두리 15/600, 버튼 사이 8)

## 메모
- 금액과 한도 비교는 base `AmountRatio` blocked("까지")이고, 이 컴포넌트는 가운데 놓기만 한다.
- 두 버튼 묶음은 base `ActionPair` md(8)이고, 다음 레벨이 없으면 주 버튼 자리를 비운다.
- 레벨 로/으로는 `packages/shared`의 `levelWithRo`(text/korean)다. LimitChangeCard도 같은 함수를 쓴다. 이 컴포넌트는 예전 import를 위해 다시 내보내기만 한다.
- 위 용이 말(숨는 얼굴)은 화면이 `DragonLine` center로 그린다. 이 컴포넌트는 숫자와 두 버튼만.
- 두 버튼은 base `Button`이다: 올리기는 primary `tall`(64, 두 줄은 이 컴포넌트가 쌓는다), 다시 고르기는 secondary `choice`(52, 15/600). 버튼 크기 값은 Button.module.css에 있고 이 컴포넌트 테스트가 클래스와 값을 함께 본다 (D-18 원칙 5).
- 올리기 버튼의 작은 글자 `leafSubInk`(#CFEBD6)는 잎색 위에서 대비가 4.5:1보다 낮다 (시안 값, 디자인 판단 필요).
- 시켜용 컨트랙트 한도는 실행 중 revert다 (D-02, D-06). 이 화면은 미리 막은 결과를 보일 뿐이고 문구에 "체인이 막았다" 같은 말을 쓰지 않는다.
