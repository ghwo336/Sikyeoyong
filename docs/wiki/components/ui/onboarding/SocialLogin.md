---
node: leaf
parent: _index.md
children: []
---

# SocialLogin

`packages/ui/src/onboarding/SocialLogin/`

## 책임
카카오, 구글 시작 버튼과 약관 한 줄을 그린다.

## 책임 아님
OAuth 진행 (콜백)

## props
`onKakao: () => void`, `onGoogle: () => void`, `loading?: 'kakao' | 'google'` (진행 중이면 두 버튼 모두 새로 시작하지 않음), `termsHref: string`, `privacyHref: string`

## 하네스 상태
`SocialLogin.stories.tsx`에 아래를 전부 만든다.
- 기본 (`Default`, Start 시안)
- 카카오 진행 중 (`KakaoLoading`)

## 쓰는 화면
Start

## 테스트 기준
- 카카오 버튼 색과 로고는 카카오 가이드대로 (바탕 #FEE500, 로고와 글자 #191919, 말풍선 로고), 카카오가 위
- 구글은 흰 테두리 버튼과 네 색 G (색은 `color.google*` 토큰)
- 버튼마다 한 번, 진행 중이면 어느 버튼도 다시 시작하지 않음
- 약관 한 줄 "시작하면 이용약관과 개인정보 처리방침에 동의하게 돼요"와 두 링크
- Start 시안 값 (버튼 사이 8, 약관 12px `ink-secondary` 가운데)

## 메모
- 버튼은 base `Button` kakao, secondary다. 시안 반경 16은 Button.md 결정대로 18로 통일된다.
