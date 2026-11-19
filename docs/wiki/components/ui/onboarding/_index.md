---
node: internal
parent: ../_index.md
children:
  - SocialLogin.md
  - KakaoVerify.md
  - EggPicker.md
  - HatchProgress.md
  - BudgetPicker.md
---

# 가입 (onboarding)

로그인, 본인 인증, 알 고르기, 부화, 예산.

영역 사이 import는 `base`와 `dragon`만 허용한다 (`conventions/architecture.md`).

| 컴포넌트 | 책임 |
| --- | --- |
| [SocialLogin](SocialLogin.md) | 카카오, 구글 시작 버튼과 약관 한 줄을 그린다. |
| [KakaoVerify](KakaoVerify.md) | 카카오톡 본인 인증 버튼과 한 줄 안내를 그린다. |
| [EggPicker](EggPicker.md) | 알 네 가지(숲, 물, 꽃, 별) 중 하나를 고르게 하고 고른 알을 그린다. |
| [HatchProgress](HatchProgress.md) | 부화 세 단계(용돈 주머니, 신분증, 한도 새기기)의 진행을 그린다. |
| [BudgetPicker](BudgetPicker.md) | 이번 달 예산 선택 칩 세 개를 그린다. |
