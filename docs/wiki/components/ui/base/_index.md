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
  - AmountChange.md
  - AmountRatio.md
  - StepProgress.md
  - Sheet.md
  - ListRow.md
  - TopBar.md
  - useSubmitLock.md
  - Icon.md
  - DetailRows.md
  - ErrorLine.md
  - ActionPair.md
  - ChoiceGroup.md
  - Skeleton.md
  - ScreenTitle.md
  - Hero.md
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
| [AmountChange](AmountChange.md) | 한 금액의 전(취소선)과 후(크게)를 화살표로 그린다. |
| [AmountRatio](AmountRatio.md) | 두 금액을 "값 / 한도"로 그린다. |
| [StepProgress](StepProgress.md) | 몇 단계 중 몇 번째인지 칸으로 그린다 (가입 3단계, 주문 4단계). |
| [Sheet](Sheet.md) | 아래에서 올라오는 시트 틀과 손잡이를 그린다. |
| [ListRow](ListRow.md) | 설정 화면의 한 줄(이름, 값, 화살표 또는 스위치)을 그린다. |
| [TopBar](TopBar.md) | 화면 위 뒤로 가기와 제목을 그린다. |
| [DetailRows](DetailRows.md) | 카드 안 읽기 전용 이름과 값 쌍을 설명 목록으로 그린다 (영수증, 신분증, 한도 바꾸기). |
| [ErrorLine](ErrorLine.md) | 실패나 다시 확인할 일을 호박색 한 줄로 그리고 화면 읽기에 알린다. |
| [ActionPair](ActionPair.md) | 주 버튼과 물러나는 버튼을 시안 간격으로 세로로 쌓는다. |
| [ChoiceGroup](ChoiceGroup.md) | 하나만 고르는 선택지 묶음을 질문과 함께 그리고 라디오 키보드 규칙을 맡는다. |
| [Skeleton](Skeleton.md) | 불러오는 중인 글자 자리에 멈춘 회색 막대를 그린다. |
| [Icon](Icon.md) | 한 가지 색 아이콘 하나를 이름으로 그린다 (뒤로, 화살표, Face ID, 카카오). |
| [ScreenTitle](ScreenTitle.md) | 화면 제목(h1)과 그 아래 짧은 설명을 묶어 그린다 (Start, Verify, Name, Hatch). |
| [Hero](Hero.md) | 큰 그림과 그 아래 글 묶음을 남은 높이 가운데에 세로로 쌓는다 (Start, Hatch). |
| [useSubmitLock](useSubmitLock.md) | 제출 콜백을 감싸 두 번 눌러도 한 번만 부르는 훅 (결제, 한도 바꾸기). |
