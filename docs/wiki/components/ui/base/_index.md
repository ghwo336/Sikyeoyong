---
node: internal
parent: ../_index.md
children:
  - Button.md
  - Chip.md
  - TextField.md
  - Switch.md
  - Meter.md
  - Amount.md
  - StepProgress.md
  - Sheet.md
  - ListRow.md
  - TopBar.md
  - useSubmitLock.md
---

# 기초 (base)

다른 영역이 가져다 쓰는 기초 부품. 토큰만 쓰고 도메인을 모른다.

영역 사이 import는 `base`와 `dragon`만 허용한다 (`conventions/architecture.md`).

| 컴포넌트 | 책임 |
| --- | --- |
| [Button](Button.md) | 누르면 콜백을 부르는 버튼 하나를 그린다. 종류는 주(잎색), 보조(테두리), 텍스트, 카카오. |
| [Chip](Chip.md) | 고를 수 있는 작은 알약 버튼(빠른 답장, 예산 고르기, 맛 평가)을 그린다. |
| [TextField](TextField.md) | 라벨이 붙은 한 줄 입력칸을 그린다. |
| [Switch](Switch.md) | 켜고 끄는 스위치 하나를 그린다. |
| [Meter](Meter.md) | 현재 값과 한도를 막대로 그린다 (예산, 한 번에, 30일). |
| [Amount](Amount.md) | 금액 숫자를 그리고, 값이 바뀌면 자리별로 굴러가며 바뀐다. |
| [StepProgress](StepProgress.md) | 몇 단계 중 몇 번째인지 칸으로 그린다 (가입 3단계, 주문 4단계). |
| [Sheet](Sheet.md) | 아래에서 올라오는 시트 틀과 손잡이를 그린다. |
| [ListRow](ListRow.md) | 설정 화면의 한 줄(이름, 값, 화살표 또는 스위치)을 그린다. |
| [TopBar](TopBar.md) | 화면 위 뒤로 가기와 제목을 그린다. |
| [useSubmitLock](useSubmitLock.md) | 제출 콜백을 감싸 두 번 눌러도 한 번만 부르는 훅 (결제, 한도 바꾸기). |
