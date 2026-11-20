---
node: internal
parent: ../_index.md
children:
  - AllowanceSummary.md
  - IdCard.md
  - FrozenPanel.md
  - CustodyNote.md
  - LookPreview.md
  - SpeciesPicker.md
---

# 용이 관리 (wallet)

용돈, 신분증, 멈춤, 맡아 둔다는 한 줄, 용이 모습 바꾸기(D-32).

영역 사이 import는 `base`와 `dragon`만 허용한다 (`conventions/architecture.md`).

| 컴포넌트 | 책임 |
| --- | --- |
| [AllowanceSummary](AllowanceSummary.md) | 주인 용돈 금액과 용이 주머니 금액, 채우기 버튼을 그린다. |
| [IdCard](IdCard.md) | 용이 신분증 카드(이름, 주인, 한 번에, 실명 확인, 태어난 날)를 그린다. |
| [FrozenPanel](FrozenPanel.md) | 용이가 자는 화면(알 속 Zz)과 돌려받기, 깨우기 버튼을 그린다. |
| [CustodyNote](CustodyNote.md) | 지금은 시켜용이 용이 용돈을 대신 맡아 둔다는 한 줄을 그린다. |
| [LookPreview](LookPreview.md) | 고른 종의 용이를 크게, 이름과 종 이름, 말버릇과 함께 그린다. |
| [SpeciesPicker](SpeciesPicker.md) | 용이 모습 네 가지 중 하나를 고르게 하고, 바뀌는 것과 그대로인 것 한 줄을 그린다. |
