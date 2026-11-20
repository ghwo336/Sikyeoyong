---
node: leaf
parent: _index.md
children: []
---

# TermsLine

`packages/ui/src/onboarding/TermsLine/`

## 책임
시작 버튼 아래 약관 한 줄과 두 링크를 그린다.

## 책임 아님
약관과 개인정보 처리방침 화면

## props
`termsHref: string`, `privacyHref: string`

## 하네스 상태
`TermsLine.stories.tsx`에 아래를 전부 만든다.
- 기본 (`Default`, Start 시안)

## 쓰는 화면
Start (EmailStart와 SocialLogin이 같이 쓴다)

## 테스트 기준
- 문구 "시작하면 이용약관과 개인정보 처리방침에 동의하게 돼요"와 두 링크
- Start 시안 값 (위 6 `size.termsTop`, 12px `ink-secondary` 가운데)

## 메모
- 2026-11-20 SocialLogin에서 떼어 냈다. 시작 방법이 둘(EmailStart, SocialLogin)이 되어 같은 줄을 두 곳에서 쓰기 때문이다.
