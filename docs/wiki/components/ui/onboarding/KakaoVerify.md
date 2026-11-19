---
node: leaf
parent: _index.md
children: []
---

# KakaoVerify

`packages/ui/src/onboarding/KakaoVerify/`

## 책임
카카오톡 본인 인증 버튼과 한 줄 안내를 그린다.

## 책임 아님
인증 진행 (콜백)

## props
`onVerify`, `mode: 'kakao' | 'mock'`, `status: 'idle' | 'pending' | 'failed'`

## 하네스 상태
`KakaoVerify.stories.tsx`에 아래를 전부 만든다.
- 기본
- 진행 중
- 실패
- 체험용 인증(mock)

## 쓰는 화면
Verify

## 테스트 기준
- mode=mock이면 문구만 바뀜

## 메모
없음
