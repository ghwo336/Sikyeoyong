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
`onKakao`, `onGoogle`, `loading?: 'kakao' | 'google'`

## 하네스 상태
`SocialLogin.stories.tsx`에 아래를 전부 만든다.
- 기본
- 카카오 진행 중

## 쓰는 화면
Start

## 테스트 기준
- 카카오 버튼 색과 로고는 카카오 가이드대로

## 메모
없음
