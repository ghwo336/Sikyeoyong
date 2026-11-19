---
node: internal
parent: ../_index.md
children:
  - LimitBlocked.md
  - LimitChangeCard.md
  - CapReached.md
---

# 한도 (limits)

한도 표시, 막힘, 변경 카드.

영역 사이 import는 `base`와 `dragon`만 허용한다 (`conventions/architecture.md`).

| 컴포넌트 | 책임 |
| --- | --- |
| [LimitBlocked](LimitBlocked.md) | 넘은 금액과 한도를 크게 비교하고 두 선택지(레벨 올리기, 다시 고르기)를 그린다. |
| [LimitChangeCard](LimitChangeCard.md) | 말로 요청한 한도 변경을 전과 후로 보여 주고 확인 버튼을 그린다. |
| [CapReached](CapReached.md) | 30일 한도를 다 썼을 때 다시 채워지는 날을 크게 그린다. |
