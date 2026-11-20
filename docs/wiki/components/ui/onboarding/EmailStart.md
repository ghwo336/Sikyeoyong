---
node: leaf
parent: _index.md
children: []
---

# EmailStart

`packages/ui/src/onboarding/EmailStart/`

## 책임
"이메일로 시작하기" 버튼 하나와 약관 한 줄(TermsLine)을 그린다 (D-29: 로그인은 파우치 로그인 하나).

## 책임 아님
로그인 진행 (파우치 금고 열기, 세션 발급). 부모(웹 세션 입구)가 한다.

## props
`onStart: () => void`, `loading?: boolean` (진행 중이면 다시 시작하지 않음), `termsHref: string`, `privacyHref: string`

## 하네스 상태
`EmailStart.stories.tsx`에 아래를 전부 만든다.
- 기본 (`Default`)
- 진행 중 (`Loading`)

## 쓰는 화면
Start

## 테스트 기준
- 버튼은 하나, base `Button` primary, 문구 "이메일로 시작하기"
- 화면에 브랜드 이름(파우치)이나 블록체인 말이 없다 (D-17)
- 한 번 누르면 한 번 시작하고, 진행 중에는 다시 시작하지 않는다

## 메모
- 시안(Start.dc.html)은 카카오와 구글 두 버튼이다. D-29로 이 하나로 바뀌었고 시안 갱신은 남은 일이다. 버튼 사이 간격은 두 버튼 시안의 `size.socialGap`을 그대로 쓴다.
- 파우치 Browser SDK에 카카오가 들어오면 이 첫 버튼만 바꾼다 (pouchi-questions 3번).
