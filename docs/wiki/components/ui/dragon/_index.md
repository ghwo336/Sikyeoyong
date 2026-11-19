---
node: internal
parent: ../_index.md
children:
  - Dragon.md
  - Egg.md
  - DragonLine.md
---

# 드래곤 (dragon)

용이 그림과 말. 표정으로 상태를 말한다. 알마다 종이 다르다(숲용, 물용, 꽃용, 별용). 그림 기준은 `design/screens/Dragons.dc.html` (D-20).

영역 사이 import는 `base`와 `dragon`만 허용한다 (`conventions/architecture.md`).

| 컴포넌트 | 책임 |
| --- | --- |
| [Dragon](Dragon.md) | 아기 드래곤을 종, 표정, 크기에 맞게 그린다. |
| [Egg](Egg.md) | 알을 그린다 (닫힌 알, 흔들리는 알, 자는 알). |
| [DragonLine](DragonLine.md) | 드래곤 한 줄 말을 고운돋움으로 그린다 (옆에 작은 드래곤). |
