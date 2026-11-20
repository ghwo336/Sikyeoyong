---
node: leaf
parent: _index.md
children: []
---

# LimitBlocked

`packages/ui/src/limits/LimitBlocked/`

## 책임
넘은 금액과 한도를 크게 비교하고 두 선택지(한도 올리고 시키기, 다시 고르기)를 그린다.

## 책임 아님
한도 변경 (콜백), 올릴 금액 계산 (부모가 shared `perOrderLimitToFit`으로 구해 넘김)

## props
`attempted: bigint` (aokrw), `limit: bigint` (aokrw, 지금 한 번에 한도), `raiseTo?: bigint` (aokrw, 이 주문이 들어가는 가장 작은 한 번에 한도. 없으면 올려도 안 들어간다), `onRaise: () => void`, `onRepick: () => void`

## 하네스 상태
`LimitBlocked.stories.tsx`에 아래를 전부 만든다.
- 기본 (`Default`, Blocked 시안)
- 올려도 안 들어감 (`CannotRaise`)

## 쓰는 화면
Blocked

## 테스트 기준
- 종 테마와 상관없이 고정 색: 뿌리에 `data-theme="fixed"` (D-32)
- 설명 문단 없음 (슬롭 금지): 글자는 금액 비교와 두 버튼뿐
- raiseTo 없으면 올리기 버튼 숨김
- 버튼마다 맞는 콜백 한 번. 올리기 버튼 이름은 "한 번에 N원으로 올리고 시키기" (금액은 늘 "원"으로 끝나 조사는 늘 "으로")
- "레벨" 말이 없다 (D-31)
- 금액은 formatOkrw (Number를 넘는 금액으로 확인)
- Blocked 시안 값 (넘은 금액 36/700 `overInk`, 한도 16px, 간격 10, 올리기 64 잎색 17/700 한 줄, 다시 고르기 52 테두리 15/600, 버튼 사이 8)

## 메모
- 돈과 경고 화면이라 종별 테마(D-32)를 따르지 않는다. 뿌리의 `data-theme="fixed"`가 `--theme-*`를 기본(숲) 색으로 되돌린다 (ui `_index.md` "종별 테마").
- 금액과 한도 비교는 base `AmountRatio` blocked("까지")이고, 이 컴포넌트는 가운데 놓기만 한다.
- 두 버튼 묶음은 base `ActionPair` md(8)이고, raiseTo가 없으면 주 버튼 자리를 비운다.
- 2026-11-20 D-31로 레벨이 없어져 `nextLevel`을 `raiseTo`로 바꿨다. 데모 장면 4는 45,000원 주문이 10,000원 한도에서 막히고 "한 번에 45,000원으로 올리고 시키기"다. `levelWithRo` 다시 내보내기도 뺐다.
- 위 용이 말(숨는 얼굴)은 화면이 `DragonLine` center로 그린다. 이 컴포넌트는 숫자와 두 버튼만.
- 두 버튼은 base `Button`이다: 올리기는 primary `tall`(64, 글자 한 줄), 다시 고르기는 secondary `choice`(52, 15/600). 버튼 크기 값은 Button.module.css에 있고 이 컴포넌트 테스트가 클래스와 값을 함께 본다 (D-18 원칙 5).
- Blocked 시안은 올리기 버튼 아래 줄에 "한 번에 50,000원까지"(옛 레벨 3 한도)를 남겨 두었다. 위 줄이 이미 새 한도를 말하고 아래 줄은 다른 숫자라 헷갈리므로 그리지 않는다 (시안 고칠 것, 디자인 판단). 이 줄의 `leafSubInk` 대비 문제도 함께 없어졌다.
- 시켜용 컨트랙트 한도는 실행 중 revert다 (D-02, D-06). 이 화면은 미리 막은 결과를 보일 뿐이고 문구에 "체인이 막았다" 같은 말을 쓰지 않는다.
