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
`onVerify: () => void`, `mode: 'kakao' | 'mock'` (설정값, D-16), `status: 'idle' | 'pending' | 'failed'`

## 하네스 상태
`KakaoVerify.stories.tsx`에 아래를 전부 만든다.
- 기본 (`Default`, Verify 시안)
- 진행 중 (`Pending`)
- 실패 (`Failed`)
- 체험용 인증(mock) (`Mock`)

## 쓰는 화면
Verify

## 테스트 기준
- mode=mock이면 문구가 바뀌고("체험용으로 인증하기", "체험판이라 실제 본인 인증 없이 넘어가요") 카카오 노란 버튼과 로고 대신 잎색 기본 버튼. 카카오 말이 하나도 없다
- kakao는 Verify 시안대로 "카카오톡으로 본인 인증" 카카오 버튼과 말풍선 로고, 아래 "구글로 가입했어도 카카오톡으로 인증해요"
- 한 번 누르면 한 번, 진행 중이면 다시 안 됨 (aria-busy)
- 실패면 알림 문구와 다시 누를 수 있는 버튼

## 메모
- 실패 줄은 base `ErrorLine` center다. 인증 중 누름 무시는 Button `loading`이 하고 이 컴포넌트는 따로 검사하지 않는다.
- 위키는 처음에 "mock이면 문구만 바뀜"이었다. 카카오 인증이 아닌 일에 카카오 색과 로고를 쓰면 카카오 디자인 가이드에 어긋나서 버튼 모양도 바꿨다 (디자인 선택). 자리는 D-16대로 같다.
- 체험용 문구와 실패 문구는 시안에 없다 (디자인 선택).
- 카카오 말풍선 로고는 SocialLogin의 `KakaoMark`를 같이 쓴다.
